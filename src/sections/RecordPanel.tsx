import { useEffect, useMemo, useRef, useState } from 'react'
import { Mic, Pause, Play, Square, X, Check, Trash2, Tag, ImagePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useRecorder } from '@/hooks/useRecorder'

const MOODS = [
  { emoji: '😊', label: '开心' },
  { emoji: '😌', label: '平静' },
  { emoji: '🤩', label: '兴奋' },
  { emoji: '😐', label: '平淡' },
  { emoji: '😢', label: '难过' },
  { emoji: '😡', label: '烦躁' },
]

export interface DraftData {
  blob: Blob
  duration: number
  transcript: string
  mood: string
  tags: string[]
  images: Blob[]
}

function fmt(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function RecordPanel({ onSave }: { onSave: (d: DraftData) => void }) {
  const rec = useRecorder()
  const [draft, setDraft] = useState<{ blob: Blob; duration: number } | null>(null)
  const [text, setText] = useState('')
  const [mood, setMood] = useState('😊')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [images, setImages] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const imageUrls = useMemo(() => images.map((f) => URL.createObjectURL(f)), [images])
  useEffect(() => {
    return () => imageUrls.forEach((u) => URL.revokeObjectURL(u))
  }, [imageUrls])

  const handleStop = async () => {
    const result = await rec.stop()
    setDraft({ blob: result.blob, duration: result.duration })
    setText(result.transcript)
  }

  const handleSave = () => {
    if (!draft) return
    onSave({
      blob: draft.blob,
      duration: draft.duration,
      transcript: text.trim(),
      mood,
      tags,
      images,
    })
    resetDraft()
  }

  const resetDraft = () => {
    setDraft(null)
    setText('')
    setMood('😊')
    setTags([])
    setTagInput('')
    setImages([])
  }

  const addImages = (files: FileList | null) => {
    if (!files) return
    const picked = [...files].filter((f) => f.type.startsWith('image/'))
    setImages((prev) => [...prev, ...picked].slice(0, 6))
  }

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, '')
    if (t && !tags.includes(t) && tags.length < 5) setTags([...tags, t])
    setTagInput('')
  }

  /* ---------- 草稿编辑态 ---------- */
  if (draft) {
    return (
      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">整理这篇日记</h2>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">
              文字记录（可编辑，时长 {fmt(draft.duration)}）
            </label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={rec.speechSupported ? '语音转写内容会出现在这里，可以自由修改…' : '当前浏览器不支持语音转写，可以手动记录文字…'}
              className="min-h-32 resize-y"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">此刻心情</label>
            <div className="flex gap-2 flex-wrap">
              {MOODS.map((m) => (
                <button
                  key={m.emoji}
                  type="button"
                  title={m.label}
                  onClick={() => setMood(m.emoji)}
                  className={`text-2xl w-11 h-11 rounded-full transition-all ${
                    mood === m.emoji
                      ? 'bg-primary/15 ring-2 ring-primary scale-110'
                      : 'hover:bg-muted'
                  }`}
                >
                  {m.emoji}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">标签（回车添加，最多 5 个）</label>
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-muted-foreground shrink-0" />
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addTag()
                  }
                }}
                placeholder="如：工作、心情、旅行"
                className="h-9"
              />
            </div>
            {tags.length > 0 && (
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {tags.map((t) => (
                  <Badge key={t} variant="secondary" className="gap-1">
                    {t}
                    <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))}>
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">照片（最多 6 张）</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                addImages(e.target.files)
                e.target.value = ''
              }}
            />
            <div className="grid grid-cols-3 gap-2">
              {images.map((f, i) => (
                <div key={`${f.name}-${i}`} className="relative group aspect-square">
                  <img
                    src={imageUrls[i]}
                    alt={f.name}
                    className="w-full h-full object-cover rounded-lg border"
                  />
                  <button
                    type="button"
                    title="移除图片"
                    onClick={() => setImages(images.filter((_, x) => x !== i))}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {images.length < 6 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                >
                  <ImagePlus className="w-6 h-6" />
                  <span className="text-xs">添加图片</span>
                </button>
              )}
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <Button onClick={handleSave} className="gap-1.5">
              <Check className="w-4 h-4" /> 保存日记
            </Button>
            <Button variant="ghost" onClick={resetDraft} className="gap-1.5 text-muted-foreground">
              <Trash2 className="w-4 h-4" /> 丢弃
            </Button>
          </div>
        </div>
      </section>
    )
  }

  /* ---------- 录音态 / 空闲态 ---------- */
  const active = rec.state !== 'idle'

  return (
    <section className="rounded-2xl border bg-card p-8 shadow-sm flex flex-col items-center">
      {!rec.speechSupported && !active && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
          当前浏览器不支持实时语音转写（推荐 Chrome / Edge），仍可正常录音并手动记录文字。
        </p>
      )}
      {rec.error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{rec.error}</p>
      )}

      {/* 录音按钮 */}
      <div className="relative">
        {rec.state === 'recording' && (
          <span className="absolute inset-0 rounded-full bg-red-400/40 animate-ping" />
        )}
        {!active ? (
          <button
            type="button"
            onClick={rec.start}
            className="relative w-24 h-24 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
            title="开始录音"
          >
            <Mic className="w-10 h-10" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleStop}
            className="relative w-24 h-24 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
            title="完成录音"
          >
            <Square className="w-8 h-8 fill-current" />
          </button>
        )}
      </div>

      {/* 计时 + 声浪 */}
      <div className="mt-4 h-8 flex items-center gap-3">
        {active ? (
          <>
            <span className={`font-mono text-lg tabular-nums ${rec.state === 'paused' ? 'text-muted-foreground' : 'text-red-500'}`}>
              {fmt(rec.elapsed)}
            </span>
            {rec.state === 'recording' && (
              <span className="flex items-end gap-0.5 h-5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className="w-1 bg-red-400 rounded-full voice-bar"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </span>
            )}
            {rec.state === 'paused' && <span className="text-sm text-muted-foreground">已暂停</span>}
          </>
        ) : (
          <span className="text-muted-foreground">点按开始，说出今天的故事</span>
        )}
      </div>

      {/* 实时转写 */}
      {active && rec.speechSupported && (rec.finalText || rec.interimText) && (
        <div className="mt-4 w-full max-h-28 overflow-y-auto rounded-lg bg-muted/60 px-4 py-3 text-sm leading-relaxed">
          {rec.finalText}
          <span className="text-muted-foreground">{rec.interimText}</span>
        </div>
      )}

      {/* 录音控制 */}
      {active && (
        <div className="flex gap-3 mt-5">
          {rec.state === 'recording' ? (
            <Button variant="outline" size="sm" onClick={rec.pause} className="gap-1.5">
              <Pause className="w-4 h-4" /> 暂停
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={rec.resume} className="gap-1.5">
              <Play className="w-4 h-4" /> 继续
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleStop} className="gap-1.5">
            <Square className="w-3.5 h-3.5" /> 完成
          </Button>
          <Button variant="ghost" size="sm" onClick={rec.cancel} className="gap-1.5 text-muted-foreground">
            <X className="w-4 h-4" /> 取消
          </Button>
        </div>
      )}
    </section>
  )
}
