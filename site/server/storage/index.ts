import { CreateBucketCommand, DeleteObjectsCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { config } from '../config'
import { logger } from '../logger'

/**
 * Private object storage. Objects are never public; the API hands out
 * short-lived signed GET URLs after checking ownership.
 */
export interface Storage {
  put(key: string, body: Buffer, contentType: string): Promise<void>
  get(key: string): Promise<Buffer>
  signedUrl(key: string): Promise<string>
  deleteMany(keys: string[]): Promise<void>
  ready(): Promise<boolean>
}

class S3Storage implements Storage {
  private client = new S3Client({
    region: config.S3_REGION,
    endpoint: config.S3_ENDPOINT || undefined,
    forcePathStyle: config.S3_FORCE_PATH_STYLE,
    credentials: { accessKeyId: config.S3_ACCESS_KEY_ID!, secretAccessKey: config.S3_SECRET_ACCESS_KEY! },
  })
  private bucket = config.S3_BUCKET

  async init() {
    if (!config.S3_AUTO_CREATE_BUCKET) return
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }))
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }))
      logger.info({ bucket: this.bucket }, 'created storage bucket')
    }
  }

  async put(key: string, body: Buffer, contentType: string) {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType, CacheControl: 'private, max-age=31536000, immutable' }),
    )
  }

  async get(key: string) {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }))
    return Buffer.from(await res.Body!.transformToByteArray())
  }

  signedUrl(key: string) {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn: config.SIGNED_URL_TTL_SECONDS })
  }

  async deleteMany(keys: string[]) {
    for (let i = 0; i < keys.length; i += 1000) {
      const chunk = keys.slice(i, i + 1000)
      if (!chunk.length) continue
      await this.client.send(new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true } }))
    }
  }

  async ready() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }))
      return true
    } catch {
      return false
    }
  }
}

/** In-process storage for the automated test suite only (enforced in config). */
class MemoryStorage implements Storage {
  objects = new Map<string, { body: Buffer; type: string }>()
  async put(key: string, body: Buffer, type: string) {
    this.objects.set(key, { body, type })
  }
  async get(key: string) {
    const o = this.objects.get(key)
    if (!o) throw new Error('not found')
    return o.body
  }
  async signedUrl(key: string) {
    return `/__test-storage/${encodeURIComponent(key)}`
  }
  async deleteMany(keys: string[]) {
    keys.forEach((k) => this.objects.delete(k))
  }
  async ready() {
    return true
  }
}

const s3 = config.STORAGE_DRIVER === 's3' ? new S3Storage() : null
export const storage: Storage = s3 ?? new MemoryStorage()

export async function initStorage() {
  await s3?.init()
}

/** Resolves signed URLs for a set of keys, skipping empty ones. */
export async function signKeys<T extends string | null | undefined>(keys: T[]): Promise<(string | null)[]> {
  return Promise.all(keys.map((k) => (k ? storage.signedUrl(k) : Promise.resolve(null))))
}
