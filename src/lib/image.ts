import { cropRect, type Crop } from './crop'

/** A photo the customer picked, shrunk and ready to crop. */
export type LoadedPhoto = {
  canvas: HTMLCanvasElement // the shrunk photo, cut from at the end
  url: string // the same photo for the <img> preview; call URL.revokeObjectURL when done
  width: number
  height: number
}

const MAX_FILE_MB = 20
const MAX_SIDE = 2048 // plenty for a 512px result, and light on a phone's memory

/** Reads a picked file, turns it the right way up and shrinks it if it's huge. */
export async function loadPhoto(file: File): Promise<LoadedPhoto> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Use a JPG, PNG or WebP photo.')
  if (file.size > MAX_FILE_MB * 1024 * 1024) throw new Error(`That photo is over ${MAX_FILE_MB} MB. Try a smaller one.`)

  // createImageBitmap reads the phone's "which way is up" note (EXIF), so photos aren't sideways
  const bitmap = await createImageBitmap(file)
  const shrink = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * shrink)
  canvas.height = Math.round(bitmap.height * shrink)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error("Couldn't read that photo.")
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  const preview = await toBlob(canvas, 'image/jpeg', 0.9)
  return { canvas, url: URL.createObjectURL(preview), width: canvas.width, height: canvas.height }
}

/**
 * Cuts the chosen square out and saves it small (WebP, or JPEG on older iPhones),
 * so a 6 MB phone photo becomes about 50 KB and fits the 2 MB limit.
 */
export async function cropPhoto(photo: LoadedPhoto, crop: Crop, size = 512): Promise<Blob> {
  const { x, y, side } = cropRect(photo, crop)
  const out = document.createElement('canvas')
  out.width = size
  out.height = size
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error("Couldn't save that photo.")
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(photo.canvas, x, y, side, side, 0, 0, size, size)
  const webp = await toBlob(out, 'image/webp', 0.85)
  // browsers that can't make WebP quietly hand back a big PNG instead
  return webp.type === 'image/webp' ? webp : toBlob(out, 'image/jpeg', 0.88)
}

async function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))
  if (!blob) throw new Error("Couldn't read that photo.")
  return blob
}
