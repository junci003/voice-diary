/**
 * 认证模块：配置了 Supabase 时走云端邮箱登录，否则退回本地账号（localStorage）。
 * 对界面暴露统一的 User 与异步接口。
 */
import { supabase, cloudEnabled } from '@/lib/supabase'

export interface User {
  /** 云端为 user id，本地为用户名 */
  id: string
  /** 展示名（邮箱或用户名） */
  name: string
}

const USERS_KEY = 'voice-diary-users'
const SESSION_KEY = 'voice-diary-session'

interface UserRecord {
  salt: string
  hash: string
  createdAt: number
}

function loadUsers(): Record<string, UserRecord> {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveUsers(users: Record<string, UserRecord>) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function genSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function validateAccount(name: string): string | null {
  if (cloudEnabled) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(name)) return '请输入有效的邮箱地址'
    return null
  }
  if (!/^[\w一-龥-]{2,20}$/.test(name)) return '用户名需为 2-20 位中英文、数字或下划线'
  return null
}

export function validatePassword(pw: string): string | null {
  if (pw.length < 6) return '密码至少 6 位'
  return null
}

export async function register(account: string, password: string): Promise<User> {
  if (cloudEnabled && supabase) {
    const { data, error } = await supabase.auth.signUp({ email: account, password })
    if (error) throw new Error(translateAuthError(error.message))
    if (!data.user) throw new Error('注册失败，请重试')
    if (!data.session) throw new Error('注册成功，请先到邮箱完成验证后再登录')
    return { id: data.user.id, name: account }
  }
  const users = loadUsers()
  if (users[account]) throw new Error('该用户名已被注册')
  const salt = genSalt()
  users[account] = { salt, hash: await hashPassword(password, salt), createdAt: Date.now() }
  saveUsers(users)
  localStorage.setItem(SESSION_KEY, account)
  return { id: account, name: account }
}

export async function login(account: string, password: string): Promise<User> {
  if (cloudEnabled && supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({ email: account, password })
    if (error) throw new Error(translateAuthError(error.message))
    return { id: data.user.id, name: account }
  }
  const users = loadUsers()
  const rec = users[account]
  if (!rec) throw new Error('用户名不存在')
  const hash = await hashPassword(password, rec.salt)
  if (hash !== rec.hash) throw new Error('密码不正确')
  localStorage.setItem(SESSION_KEY, account)
  return { id: account, name: account }
}

export async function logout(): Promise<void> {
  if (cloudEnabled && supabase) {
    await supabase.auth.signOut()
    return
  }
  localStorage.removeItem(SESSION_KEY)
}

/** 恢复当前会话 */
export async function getCurrentUser(): Promise<User | null> {
  if (cloudEnabled && supabase) {
    const { data } = await supabase.auth.getSession()
    const u = data.session?.user
    return u ? { id: u.id, name: u.email ?? '已登录用户' } : null
  }
  const name = localStorage.getItem(SESSION_KEY)
  return name ? { id: name, name } : null
}

/** 订阅登录态变化（云端模式） */
export function onAuthChange(callback: (user: User | null) => void): () => void {
  if (cloudEnabled && supabase) {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user
      callback(u ? { id: u.id, name: u.email ?? '已登录用户' } : null)
    })
    return () => data.subscription.unsubscribe()
  }
  return () => {}
}

function translateAuthError(msg: string): string {
  if (msg.includes('Invalid login credentials')) return '邮箱或密码不正确'
  if (msg.includes('User already registered')) return '该邮箱已被注册'
  if (msg.includes('Email not confirmed')) return '请先完成邮箱验证'
  if (msg.includes('Password should be')) return '密码强度不足（至少 6 位）'
  if (msg.includes('rate limit')) return '操作太频繁，请稍后再试'
  return msg
}
