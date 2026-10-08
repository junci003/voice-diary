export interface DiaryEntry {
  id: string
  createdAt: number
  /** 录音时长（秒） */
  duration: number
  audioBlob: Blob
  transcript: string
  /** 心情 emoji */
  mood: string
  tags: string[]
  /** 附加图片 */
  images: Blob[]
}
