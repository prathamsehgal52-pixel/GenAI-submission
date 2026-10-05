import { createHash } from 'node:crypto'
import sharp, { type Metadata } from 'sharp'
import type { Crop } from '../db/schema'
import { AppError } from '../http'

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024
const MAX_PIXELS = 60_000_000
const ACCEPTED = new Set(['jpeg', 'png', 'webp', 'avif', 'heif'])

sharp.cache(false)
sharp.concurrency(2)

export type ProcessedImage = {
  sha256: string
  display: Buffer
  thumb: Buffer
  width: number
  height: number
}

/**
 * Validates an uploaded photo by decoding it (the declared content type and
 * extension are not trusted), then produces web-optimised display and thumb
 * renditions. Re-encoding strips EXIF/GPS metadata and any embedded payloads.
 */
export async function processUpload(input: Buffer): Promise<ProcessedImage> {
  if (input.byteLength === 0) throw new AppError(422, 'empty_file', 'That file is empty.')
  if (input.byteLength > MAX_UPLOAD_BYTES) throw new AppError(413, 'file_too_large', 'Photos must be 15 MB or smaller.')

  let meta: Metadata
  try {
    meta = await sharp(input, { limitInputPixels: MAX_PIXELS, failOn: 'error' }).metadata()
  } catch {
    throw new AppError(415, 'unsupported_image', 'We couldn’t read that file as a photo. Try a JPEG, PNG, WebP or AVIF image.')
  }
  if (!meta.format || !ACCEPTED.has(meta.format)) {
    throw new AppError(415, 'unsupported_image', 'We couldn’t read that file as a photo. Try a JPEG, PNG, WebP or AVIF image.')
  }
  if ((meta.width ?? 0) < 200 || (meta.height ?? 0) < 200) {
    throw new AppError(422, 'image_too_small', 'That photo is too small. Use an image at least 200 pixels on each side.')
  }

  const sha256 = createHash('sha256').update(input).digest('hex')
  const base = () => sharp(input, { limitInputPixels: MAX_PIXELS }).rotate()
  try {
    const { data: display, info } = await base()
      .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true })
    const thumb = await base().resize(480, 480, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 78 }).toBuffer()
    return { sha256, display, thumb, width: info.width, height: info.height }
  } catch {
    throw new AppError(415, 'unsupported_image', 'We couldn’t process that photo. Try exporting it as a JPEG and uploading again.')
  }
}

/** Crops a garment out of a multi-item photo (normalised 0..1 box, padded). */
export async function cropGarment(display: Buffer, crop: Crop) {
  const img = sharp(display)
  const { width = 0, height = 0 } = await img.metadata()
  const pad = 0.04
  const x = Math.max(0, crop.x - pad)
  const y = Math.max(0, crop.y - pad)
  const w = Math.min(1 - x, crop.w + pad * 2)
  const h = Math.min(1 - y, crop.h + pad * 2)
  const region = {
    left: Math.round(x * width),
    top: Math.round(y * height),
    width: Math.max(32, Math.round(w * width)),
    height: Math.max(32, Math.round(h * height)),
  }
  region.width = Math.min(region.width, width - region.left)
  region.height = Math.min(region.height, height - region.top)
  const image = await sharp(display).extract(region).webp({ quality: 84 }).toBuffer()
  const thumb = await sharp(image).resize(480, 480, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 78 }).toBuffer()
  return { image, thumb }
}

/** A compact JPEG rendition for vision models (keeps token cost predictable). */
export async function forVision(display: Buffer) {
  return sharp(display).resize(1024, 1024, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer()
}

export const isValidCrop = (c: Crop) =>
  [c.x, c.y, c.w, c.h].every((n) => Number.isFinite(n) && n >= 0 && n <= 1) && c.w >= 0.05 && c.h >= 0.05 && c.x + c.w <= 1.001 && c.y + c.h <= 1.001
