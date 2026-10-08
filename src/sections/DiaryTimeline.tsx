import { useEffect, useMemo, useState } from 'react'
import { Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { DiaryEntry } from '@/types/diary'

function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function dayKey(ts: number) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function dayLabel(ts: number) {
  const d = new Date(ts)
  const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
  const today = new Date()
  const yesterday = new Date(today.getTime() - 86400000)
  let prefix = ''
  if (dayKey(ts) === dayKey(today.getTime())) prefix = '今天 · '
  else if (dayKey(ts) === dayKey(yesterday.getTime())) prefix = '昨天 · '
  return `${prefix}${d.getMonth() + 1}月${d.getDate()}日 星期${week}`
}

function DiaryCard({ entry, onDelete }: { entry: DiaryEntry; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const url = useMemo(
    () => entry.audioUrl ?? (entry.audioBlob ? URL.createObjectURL(entry.audioBlob) : ''),
    [entry.audioUrl, entry.audioBlob],
  )
  const imageUrls = useMemo(
    () => entry.imageUrls ?? (entry.images ?? []).map((b) => URL.createObjectURL(b)),
    [entry.imageUrls, entry.images],
  )
  useEffect(
    () => () => {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url)
      imageUrls.forEach((u) => {
        if (u.startsWith('blob:')) URL.revokeObjectURL(u)
      })
    },
    [url, imageUrls],
  )

  const time = new Date(entry.createdAt)
  const hhmm = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`
  const longText = entry.transcript.length > 120

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="text-xl">{entry.mood}</span>
          <span className="font-medium text-foreground">{hhmm}</span>
          <span>· {fmtDuration(entry.duration)}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          title="删除这篇日记"
          onClick={() => onDelete(entry.id)}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      <audio controls src={url} className="w-full h-9 mb-2" />

      {imageUrls.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-2">
          {imageUrls.map((u, i) => (
            <button
              key={i}
              type="button"
              className="aspect-square"
              title="点击查看大图"
              onClick={() => window.open(u, '_blank')}
            >
              <img src={u} alt={`日记图片 ${i + 1}`} className="w-full h-full object-cover rounded-lg border" />
            </button>
          ))}
        </div>
      )}

      {entry.transcript && (
        <p className={`text-sm leading-relaxed whitespace-pre-wrap ${!expanded && longText ? 'line-clamp-3' : ''}`}>
          {entry.transcript}
        </p>
      )}
      {longText && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-primary mt-1 flex items-center gap-0.5"
        >
          {expanded ? (
            <>
              收起 <ChevronUp className="w-3 h-3" />
            </>
          ) : (
            <>
              展开全文 <ChevronDown className="w-3 h-3" />
            </>
          )}
        </button>
      )}

      {entry.tags.length > 0 && (
        <div className="flex gap-1.5 mt-2.5 flex-wrap">
          {entry.tags.map((t) => (
            <Badge key={t} variant="secondary" className="text-xs">
              {t}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

export default function DiaryTimeline({
  entries,
  onDelete,
}: {
  entries: DiaryEntry[]
  onDelete: (id: string) => void
}) {
  const groups = useMemo(() => {
    const map = new Map<string, DiaryEntry[]>()
    for (const e of entries) {
      const k = dayKey(e.createdAt)
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(e)
    }
    return [...map.values()]
  }, [entries])

  if (entries.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-4xl mb-3">🎙️</p>
        <p>还没有日记，录下第一段声音吧</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={dayKey(group[0].createdAt)}>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary/60" />
            {dayLabel(group[0].createdAt)}
            <span className="text-xs font-normal">（{group.length} 篇）</span>
          </h3>
          <div className="space-y-3 pl-4 border-l-2 border-border ml-1">
            {group.map((e) => (
              <DiaryCard key={e.id} entry={e} onDelete={onDelete} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
