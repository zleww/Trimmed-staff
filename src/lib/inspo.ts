// Getting an inspo photo or video ready before it goes up.
// The free Supabase plan has 1 GB of storage for everything, so photos are
// shrunk and videos are kept short.

export const MAX_INSPO = 3
export const MAX_VIDEO_SECONDS = 30
const MAX_VIDEO_MB = 25 // the bucket refuses anything bigger
const MAX_PHOTO_SIDE = 1600

export type ReadyInspo = {
  key: string // for React lists
  blob: Blob
  kind: 'image' | 'video'
  preview: string // object URL; revoke when done
}

const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm']

/** Throws a plain sentence if the file can't be used. */
export async function prepareInspo(file: File): Promise<ReadyInspo> {
  if (VIDEO_TYPES.includes(file.type)) return prepareVideo(file)
  if (/^image\/(jpeg|png|webp)$/.test(file.type)) return preparePhoto(file)
  throw new Error('Use a JPG, PNG or WebP photo, or an MP4 or MOV video.')
}

async function preparePhoto(file: File): Promise<ReadyInspo> {
  const bitmap = await createImageBitmap(file)
  const shrink = Math.min(1, MAX_PHOTO_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * shrink)
  canvas.height = Math.round(bitmap.height * shrink)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error("Couldn't read that photo.")
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const webp = await toBlob(canvas, 'image/webp', 0.82)
  // older iPhones can't make WebP and hand back a big PNG
  const blob = webp.type === 'image/webp' ? webp : await toBlob(canvas, 'image/jpeg', 0.85)
  return { key: crypto.randomUUID(), blob, kind: 'image', preview: URL.createObjectURL(blob) }
}

async function prepareVideo(file: File): Promise<ReadyInspo> {
  if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
    throw new Error(`That video is over ${MAX_VIDEO_MB} MB. Trim it to ${MAX_VIDEO_SECONDS} seconds or less.`)
  }
  const preview = URL.createObjectURL(file)
  const seconds = await videoLength(preview)
  if (seconds > MAX_VIDEO_SECONDS + 0.5) {
    URL.revokeObjectURL(preview)
    throw new Error(`Keep videos to ${MAX_VIDEO_SECONDS} seconds or less. That one is ${Math.round(seconds)} seconds.`)
  }
  return { key: crypto.randomUUID(), blob: file, kind: 'video', preview }
}

/** Reads a video's length in seconds. 0 if the browser can't tell (the size limit still applies). */
function videoLength(url: string): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    const done = (value: number) => {
      clearTimeout(timer)
      video.removeAttribute('src')
      resolve(Number.isFinite(value) ? value : 0)
    }
    const timer = setTimeout(() => done(0), 5000)
    video.preload = 'metadata'
    video.onloadedmetadata = () => done(video.duration)
    video.onerror = () => done(0)
    video.src = url
  })
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't read that photo."))), type, quality),
  )
}
