import { useCallback, useEffect, useRef, useState } from 'react'

export type RecorderState = 'idle' | 'recording' | 'paused'

export interface RecordResult {
  blob: Blob
  duration: number
  transcript: string
}

const speechSupported =
  typeof window !== 'undefined' &&
  !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)

export function useRecorder() {
  const [state, setState] = useState<RecorderState>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [finalText, setFinalText] = useState('')
  const [interimText, setInterimText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const recognitionRef = useRef<any>(null)
  const finalRef = useRef('')
  const timerRef = useRef<number | null>(null)
  const elapsedRef = useRef(0)
  const stateRef = useRef<RecorderState>('idle')

  const setStateBoth = (s: RecorderState) => {
    stateRef.current = s
    setState(s)
  }

  const startTimer = () => {
    stopTimer()
    timerRef.current = window.setInterval(() => {
      elapsedRef.current += 1
      setElapsed(elapsedRef.current)
    }, 1000)
  }

  const stopTimer = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const startRecognition = () => {
    if (!speechSupported) return
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const rec = new SR()
    rec.lang = 'zh-CN'
    rec.continuous = true
    rec.interimResults = true
    rec.onresult = (e: any) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) finalRef.current += r[0].transcript
        else interim += r[0].transcript
      }
      setFinalText(finalRef.current)
      setInterimText(interim)
    }
    rec.onend = () => {
      // 浏览器会自动结束识别，录音中则自动重启
      if (stateRef.current === 'recording' && recognitionRef.current === rec) {
        try {
          rec.start()
        } catch {
          /* ignore */
        }
      }
    }
    rec.onerror = () => {
      /* 识别失败不阻塞录音 */
    }
    recognitionRef.current = rec
    try {
      rec.start()
    } catch {
      /* ignore */
    }
  }

  const stopRecognition = () => {
    const rec = recognitionRef.current
    recognitionRef.current = null
    if (rec) {
      try {
        rec.onend = null
        rec.stop()
      } catch {
        /* ignore */
      }
    }
  }

  const cleanupStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  const start = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mr = new MediaRecorder(stream)
      mediaRecorderRef.current = mr
      chunksRef.current = []
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      mr.start(250)

      finalRef.current = ''
      setFinalText('')
      setInterimText('')
      startRecognition()

      elapsedRef.current = 0
      setElapsed(0)
      startTimer()
      setStateBoth('recording')
    } catch {
      setError('无法访问麦克风，请在浏览器中允许麦克风权限后重试')
      cleanupStream()
    }
  }, [])

  const pause = useCallback(() => {
    const mr = mediaRecorderRef.current
    if (!mr || mr.state !== 'recording') return
    mr.pause()
    stopTimer()
    stopRecognition()
    setStateBoth('paused')
  }, [])

  const resume = useCallback(() => {
    const mr = mediaRecorderRef.current
    if (!mr || mr.state !== 'paused') return
    mr.resume()
    startTimer()
    startRecognition()
    setStateBoth('recording')
  }, [])

  /** 结束录音，返回音频与转写结果 */
  const stop = useCallback((): Promise<RecordResult> => {
    return new Promise((resolve) => {
      const mr = mediaRecorderRef.current
      stopTimer()
      stopRecognition()
      setStateBoth('idle')
      const finish = (blob: Blob) => {
        cleanupStream()
        mediaRecorderRef.current = null
        setInterimText('')
        resolve({
          blob,
          duration: elapsedRef.current,
          transcript: (finalRef.current + '').trim(),
        })
      }
      if (!mr || mr.state === 'inactive') {
        finish(new Blob(chunksRef.current, { type: 'audio/webm' }))
        return
      }
      mr.onstop = () => {
        finish(new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' }))
      }
      mr.stop()
    })
  }, [])

  /** 放弃当前录音 */
  const cancel = useCallback(() => {
    const mr = mediaRecorderRef.current
    stopTimer()
    stopRecognition()
    if (mr && mr.state !== 'inactive') {
      mr.onstop = null
      try {
        mr.stop()
      } catch {
        /* ignore */
      }
    }
    cleanupStream()
    mediaRecorderRef.current = null
    chunksRef.current = []
    finalRef.current = ''
    setFinalText('')
    setInterimText('')
    elapsedRef.current = 0
    setElapsed(0)
    setStateBoth('idle')
  }, [])

  useEffect(() => {
    return () => {
      stopTimer()
      stopRecognition()
      cleanupStream()
    }
  }, [])

  return {
    state,
    elapsed,
    finalText,
    interimText,
    error,
    speechSupported,
    start,
    pause,
    resume,
    stop,
    cancel,
  }
}
