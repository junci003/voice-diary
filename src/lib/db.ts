/**
 * 存储层：登录用户使用 Supabase（Postgres 元数据 + Storage 媒体文件），
 * 游客使用本地 IndexedDB。对界面暴露统一的 DiaryEntry。
 */
import type { DiaryEntry } from '@/types/diary'
import type { User } from '@/lib/auth'
import { supabase, cloudEnabled } from '@/lib/supabase'

const STORE = 'entries'
const BUCKET = 'diary-media'
const SIGNED_URL_TTL = 60 * 60 * 24 // 1 天

function useCloud(user: User | null) {
  return cloudEnabled && supabase && user !== null
}

/* ---------------- 本地 IndexedDB ---------------- */

function openDB(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function localSave(entry: DiaryEntry): Promise<void> {
  const db = await openDB('voice-diary')
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(entry)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function localList(): Promise<DiaryEntry[]> {
  const db = await openDB('voice-diary')
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => {
      resolve((req.result as DiaryEntry[]).sort((a, b) => b.createdAt - a.createdAt))
    }
    req.onerror = () => reject(req.error)
  })
}

async function localDelete(id: string): Promise<void> {
  const db = await openDB('voice-diary')
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/* ---------------- 云端 Supabase ---------------- */

interface CloudRow {
  id: string
  created_at: string
  duration: number
  transcript: string
  mood: string
  tags: string[]
  audio_path: string
  image_paths: string[]
}

async function cloudSave(user: User, entry: DiaryEntry): Promise<void> {
  const sb = supabase!
  const audioPath = `${user.id}/${entry.id}/audio`
  const { error: upErr } = await sb.storage
    .from(BUCKET)
    .upload(audioPath, entry.audioBlob!, { contentType: entry.audioBlob!.type || 'audio/webm' })
  if (upErr) throw new Error('音频上传失败：' + upErr.message)

  const imagePaths: string[] = []
  for (let i = 0; i < (entry.images ?? []).length; i++) {
    const img = entry.images![i]
    const p = `${user.id}/${entry.id}/image-${i}`
    const { error } = await sb.storage.from(BUCKET).upload(p, img, { contentType: img.type || 'image/png' })
    if (error) throw new Error('图片上传失败：' + error.message)
    imagePaths.push(p)
  }

  const { error } = await sb.from('diary_entries').insert({
    id: entry.id,
    user_id: user.id,
    created_at: new Date(entry.createdAt).toISOString(),
    duration: entry.duration,
    transcript: entry.transcript,
    mood: entry.mood,
    tags: entry.tags,
    audio_path: audioPath,
    image_paths: imagePaths,
  })
  if (error) throw new Error('日记保存失败：' + error.message)
}

async function signPaths(paths: string[]): Promise<string[]> {
  const sb = supabase!
  if (paths.length === 0) return []
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_TTL)
  if (error) return []
  return (data ?? []).map((d) => d.signedUrl).filter((u): u is string => !!u)
}

async function cloudList(): Promise<DiaryEntry[]> {
  const sb = supabase!
  const { data, error } = await sb
    .from('diary_entries')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error('读取日记失败：' + error.message)

  const rows = (data ?? []) as CloudRow[]
  return Promise.all(
    rows.map(async (r) => {
      const [audioUrl] = await signPaths([r.audio_path])
      const imageUrls = await signPaths(r.image_paths ?? [])
      return {
        id: r.id,
        createdAt: new Date(r.created_at).getTime(),
        duration: r.duration,
        transcript: r.transcript,
        mood: r.mood,
        tags: r.tags ?? [],
        audioUrl,
        imageUrls,
      } satisfies DiaryEntry
    }),
  )
}

async function cloudDelete(user: User, id: string): Promise<void> {
  const sb = supabase!
  const { error } = await sb.from('diary_entries').delete().eq('id', id)
  if (error) throw new Error('删除失败：' + error.message)
  // 清理存储文件
  const { data: files } = await sb.storage.from(BUCKET).list(`${user.id}/${id}`)
  if (files && files.length > 0) {
    await sb.storage.from(BUCKET).remove(files.map((f) => `${user.id}/${id}/${f.name}`))
  }
}

/* ---------------- 统一入口 ---------------- */

export async function saveEntry(user: User | null, entry: DiaryEntry): Promise<void> {
  if (useCloud(user)) return cloudSave(user!, entry)
  return localSave(entry)
}

export async function getAllEntries(user: User | null): Promise<DiaryEntry[]> {
  if (useCloud(user)) return cloudList()
  return localList()
}

export async function deleteEntry(user: User | null, id: string): Promise<void> {
  if (useCloud(user)) return cloudDelete(user!, id)
  return localDelete(id)
}
