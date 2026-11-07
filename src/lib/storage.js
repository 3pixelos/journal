import { supabase, SCREENSHOT_BUCKET, AVATAR_BUCKET } from './supabase'

const MAX_BYTES = 10 * 1024 * 1024

/**
 * Upload one screenshot into the caller's own folder:  <uid>/<uuid>.<ext>
 * The leading folder is what the storage RLS policy checks, so it must be
 * the user id.
 */
export async function uploadScreenshot(file, userId) {
  if (!file.type.startsWith('image/')) throw new Error('Only image files are allowed.')
  if (file.size > MAX_BYTES) throw new Error('Image is larger than 10 MB.')

  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '')
  const path = `${userId}/${crypto.randomUUID()}.${ext || 'png'}`

  const { error } = await supabase.storage
    .from(SCREENSHOT_BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type })
  if (error) throw error
  return path
}

/**
 * Every screenshot this user has ever uploaded, newest first.
 *
 * Storage is the record of what exists; the attachments table is only the
 * record of what each file is *for*. When the two disagree the file is still
 * here, which is what makes a lost chart recoverable.
 */
export async function listMyScreenshots(userId) {
  const { data, error } = await supabase.storage
    .from(SCREENSHOT_BUCKET)
    .list(userId, { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } })
  if (error) throw error
  return (data || [])
    .filter((f) => f.id)   // folders come back with a null id
    .map((f) => ({ path: `${userId}/${f.name}`, createdAt: f.created_at }))
}

export async function removeScreenshot(path) {
  await supabase.storage.from(SCREENSHOT_BUCKET).remove([path])
}

/**
 * Batch-sign paths for display.
 *
 * Returns the reason on failure rather than an empty map: a silent {} left
 * the UI showing a grey placeholder for ever, which looks identical to an
 * image that is still loading and tells you nothing about why.
 */
export async function signPaths(paths, expiresIn = 3600) {
  const unique = [...new Set(paths.filter(Boolean))]
  if (!unique.length) return { urls: {}, error: null }

  const { data, error } = await supabase.storage
    .from(SCREENSHOT_BUCKET)
    .createSignedUrls(unique, expiresIn)

  if (error) {
    return { urls: {}, error: error.message || 'Could not reach image storage.' }
  }

  const urls = {}
  const failed = []
  for (const row of data || []) {
    if (row.signedUrl && !row.error) urls[row.path] = row.signedUrl
    else failed.push(row.path)
  }
  return {
    urls,
    error: failed.length
      ? `${failed.length} image${failed.length === 1 ? '' : 's'} could not be loaded.`
      : null,
  }
}

/**
 * Upload a profile picture into the caller's own folder: <uid>/<uuid>.<ext>
 * As with screenshots, the leading folder is what the storage policy checks.
 */
export async function uploadAvatar(file, userId) {
  if (!file.type.startsWith('image/')) throw new Error('Only image files are allowed.')
  if (file.size > 3 * 1024 * 1024) throw new Error('Picture is larger than 3 MB.')

  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '')
  const path = `${userId}/${crypto.randomUUID()}.${ext || 'png'}`

  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type })
  if (error) throw error
  return path
}

export async function removeAvatar(path) {
  await supabase.storage.from(AVATAR_BUCKET).remove([path])
}

/**
 * Signed URLs for profile pictures, cached by path.
 *
 * An avatar turns up in a dozen places on a page — every journal tile, every
 * row of the trading floor — and signing each one separately would be a
 * network round trip per face, repeated on every render. One promise per
 * path, shared by everyone who asks, re-signed when it is close to expiring.
 */
const AVATAR_TTL = 3600
const avatarCache = new Map()   // path -> { url, until, promise }

export function signAvatar(path) {
  const now = Date.now()
  const hit = avatarCache.get(path)
  if (hit && hit.url && hit.until > now) return Promise.resolve(hit.url)
  if (hit?.promise) return hit.promise

  const promise = supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(path, AVATAR_TTL)
    .then(({ data, error }) => {
      const url = error ? null : data?.signedUrl || null
      // Re-sign a minute early rather than at the stroke of expiry.
      avatarCache.set(path, { url, until: now + (AVATAR_TTL - 60) * 1000 })
      return url
    })
    .catch(() => {
      avatarCache.delete(path)
      return null
    })

  avatarCache.set(path, { ...(hit || {}), promise })
  return promise
}

/** Forget one path, so the next render signs the new file rather than the old. */
export const forgetAvatar = (path) => avatarCache.delete(path)
