import { useCallback, useEffect, useMemo, useState } from 'react'
import { BookHeart, Search, LogIn, LogOut, UserRound, Cloud } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import RecordPanel, { type DraftData } from '@/sections/RecordPanel'
import DiaryTimeline from '@/sections/DiaryTimeline'
import AuthDialog from '@/sections/AuthDialog'
import { deleteEntry, getAllEntries, saveEntry } from '@/lib/db'
import { getCurrentUser, logout, onAuthChange, type User } from '@/lib/auth'
import { cloudEnabled } from '@/lib/supabase'
import type { DiaryEntry } from '@/types/diary'

export default function Home() {
  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const [query, setQuery] = useState('')
  const [user, setUser] = useState<User | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [syncError, setSyncError] = useState<string | null>(null)

  const reload = useCallback(
    async (u: User | null) => {
      try {
        setEntries(await getAllEntries(u))
        setSyncError(null)
      } catch (e) {
        setSyncError(e instanceof Error ? e.message : '同步失败')
      }
    },
    [],
  )

  // 恢复会话并订阅登录态
  useEffect(() => {
    getCurrentUser().then(async (u) => {
      setUser(u)
      await reload(u)
      setLoading(false)
    })
    return onAuthChange((u) => {
      setUser(u)
      reload(u)
    })
  }, [reload])

  const handleSave = useCallback(
    async (d: DraftData) => {
      await saveEntry(user, {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        duration: d.duration,
        audioBlob: d.blob,
        transcript: d.transcript,
        mood: d.mood,
        tags: d.tags,
        images: d.images,
      })
      await reload(user)
    },
    [reload, user],
  )

  const handleDelete = useCallback(
    async (id: string) => {
      if (!window.confirm('确定删除这篇日记吗？删除后无法恢复。')) return
      await deleteEntry(user, id)
      await reload(user)
    },
    [reload, user],
  )

  const handleLogout = async () => {
    if (!window.confirm(`退出「${user?.name}」的登录吗？`)) return
    await logout()
    if (!cloudEnabled) setUser(null)
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return entries
    return entries.filter(
      (e) =>
        e.transcript.toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q)),
    )
  }, [entries, query])

  const totalMinutes = Math.round(entries.reduce((s, e) => s + e.duration, 0) / 60)

  return (
    <div className="min-h-screen">
      <header className="border-b bg-card/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 shrink-0">
            <BookHeart className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-bold tracking-tight">语音日记</h1>
          </div>
          <div className="flex items-center gap-3">
            {entries.length > 0 && (
              <p className="text-xs text-muted-foreground hidden sm:block">
                共 {entries.length} 篇 · 累计 {totalMinutes} 分钟
              </p>
            )}
            {user ? (
              <div className="flex items-center gap-1.5">
                <span className="flex items-center gap-1 text-sm bg-primary/10 text-primary rounded-full px-3 py-1 max-w-44 truncate">
                  {cloudEnabled && <Cloud className="w-3.5 h-3.5 shrink-0" />}
                  <UserRound className="w-3.5 h-3.5 shrink-0" />
                  {user.name}
                </span>
                <Button variant="ghost" size="icon" className="h-8 w-8" title="退出登录" onClick={handleLogout}>
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setAuthOpen(true)}>
                <LogIn className="w-4 h-4" /> 登录
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-8">
        {!user && (
          <p className="text-xs text-muted-foreground text-center -mb-2">
            当前为游客模式 ·{' '}
            <button type="button" className="text-primary underline underline-offset-2" onClick={() => setAuthOpen(true)}>
              登录
            </button>{' '}
            {cloudEnabled ? '后日记自动云端同步' : '后可拥有自己的独立日记空间'}
          </p>
        )}
        {syncError && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-center -mb-2">
            {syncError}
          </p>
        )}

        <RecordPanel onSave={handleSave} />

        <section>
          <div className="flex items-center justify-between mb-4 gap-3">
            <h2 className="text-lg font-semibold shrink-0">时光轴</h2>
            <div className="relative flex-1 max-w-56">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索文字或标签"
                className="pl-8 h-9"
              />
            </div>
          </div>
          {loading ? (
            <p className="text-center py-10 text-muted-foreground">加载中…</p>
          ) : query && filtered.length === 0 ? (
            <p className="text-center py-10 text-muted-foreground">没有找到匹配的日记</p>
          ) : (
            <DiaryTimeline entries={filtered} onDelete={handleDelete} />
          )}
        </section>
      </main>

      <footer className="text-center text-xs text-muted-foreground pb-8">
        {cloudEnabled && user
          ? '日记已同步到云端，仅你的账号可见'
          : '所有数据仅保存在本机浏览器中，不会上传'}
      </footer>

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} onSuccess={(u) => setUser(u)} />
    </div>
  )
}
