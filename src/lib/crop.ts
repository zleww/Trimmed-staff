// The math behind the profile photo cropper. No React here, so it can be tested on its own.
//
// Everything is in photo pixels, not screen pixels, so the crop stays the same
// when the phone rotates or the box changes size.

export type Photo = { width: number; height: number }

/** Where the circle sits on the photo: its center (cx, cy) and how far we zoomed in. */
export type Crop = { zoom: number; cx: number; cy: number }

export const MIN_ZOOM = 1
export const MAX_ZOOM = 4

/** At zoom 1 the circle is as wide as the photo's short side. */
export function sideAt(photo: Photo, zoom: number): number {
  return Math.min(photo.width, photo.height) / zoom
}

/** Start in the middle, fully zoomed out. */
export function centered(photo: Photo): Crop {
  return { zoom: MIN_ZOOM, cx: photo.width / 2, cy: photo.height / 2 }
}

const between = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))

/** Keeps the zoom in range and the square inside the photo, so there is never an empty edge. */
export function clampCrop(photo: Photo, crop: Crop): Crop {
  const zoom = between(crop.zoom, MIN_ZOOM, MAX_ZOOM)
  const half = sideAt(photo, zoom) / 2
  return {
    zoom,
    cx: between(crop.cx, half, photo.width - half),
    cy: between(crop.cy, half, photo.height - half),
  }
}

/** Drag on screen by (dx, dy) screen pixels. The photo follows the finger, so the center moves the other way. */
export function pan(photo: Photo, crop: Crop, dx: number, dy: number, boxSize: number): Crop {
  const photoPxPerScreenPx = sideAt(photo, crop.zoom) / boxSize
  return clampCrop(photo, { ...crop, cx: crop.cx - dx * photoPxPerScreenPx, cy: crop.cy - dy * photoPxPerScreenPx })
}

/** Zoom by a factor (1.1 = 10% closer). The point under the circle's center stays put. */
export function zoomBy(photo: Photo, crop: Crop, factor: number): Crop {
  return clampCrop(photo, { ...crop, zoom: crop.zoom * factor })
}

/** The square to cut out of the photo, in photo pixels (top-left corner and side). */
export function cropRect(photo: Photo, crop: Crop): { x: number; y: number; side: number } {
  const side = sideAt(photo, crop.zoom)
  return { x: crop.cx - side / 2, y: crop.cy - side / 2, side }
}
