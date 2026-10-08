export interface DiaryEntry {
  id: string
  createdAt: number
  /** 录音时长（秒） */
  duration: number
  transcript: string
  /** 心情 emoji */
  mood: string
  tags: string[]
  /** 本地模式：音频 Blob */
  audioBlob?: Blob
  /** 本地模式：图片 Blob 列表 */
  images?: Blob[]
  /** 云端模式：音频签名 URL */
  audioUrl?: string
  /** 云端模式：图片签名 URL 列表 */
  imageUrls?: string[]
}
