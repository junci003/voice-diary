/**
 * 本地账号系统（MVP 阶段）。
 * 账号信息（用户名 + 加盐哈希密码）存 localStorage，会话存 localStorage。
 * 数据按账号隔离到独立的 IndexedDB，未来接入云端时只需替换本模块的实现。
 */

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

export function validateUsername(name: string): string | null {
  if (!/^[\w一-龥-]{2,20}$/.test(name)) return '用户名需为 2-20 位中英文、数字或下划线'
  return null
}

export function validatePassword(pw: string): string | null {
  if (pw.length < 6) return '密码至少 6 位'
  return null
}

export async function register(username: string, password: string): Promise<void> {
  const users = loadUsers()
  if (users[username]) throw new Error('该用户名已被注册')
  const salt = genSalt()
  users[username] = { salt, hash: await hashPassword(password, salt), createdAt: Date.now() }
  saveUsers(users)
  localStorage.setItem(SESSION_KEY, username)
}

export async function login(username: string, password: string): Promise<void> {
  const users = loadUsers()
  const rec = users[username]
  if (!rec) throw new Error('用户名不存在')
  const hash = await hashPassword(password, rec.salt)
  if (hash !== rec.hash) throw new Error('密码不正确')
  localStorage.setItem(SESSION_KEY, username)
}

export function logout() {
  localStorage.removeItem(SESSION_KEY)
}

export function getSession(): string | null {
  return localStorage.getItem(SESSION_KEY)
}
