import type { DiaryEntry } from '@/types/diary'

const STORE = 'entries'

/** 每个账号一个独立的 IndexedDB，游客使用默认库 */
export function dbNameFor(user: string | null): string {
  return user ? `voice-diary-u-${user}` : 'voice-diary'
}

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

export async function saveEntry(user: string | null, entry: DiaryEntry): Promise<void> {
  const db = await openDB(dbNameFor(user))
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(entry)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getAllEntries(user: string | null): Promise<DiaryEntry[]> {
  const db = await openDB(dbNameFor(user))
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => {
      const list = (req.result as DiaryEntry[]).sort((a, b) => b.createdAt - a.createdAt)
      resolve(list)
    }
    req.onerror = () => reject(req.error)
  })
}

export async function deleteEntry(user: string | null, id: string): Promise<void> {
  const db = await openDB(dbNameFor(user))
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
