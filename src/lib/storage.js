import { supabase, SCREENSHOT_BUCKET } from './supabase'

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

export async function removeScreenshot(path) {
  await supabase.storage.from(SCREENSHOT_BUCKET).remove([path])
}

/** Batch-sign paths for display. Returns { path: url }. */
export async function signPaths(paths, expiresIn = 3600) {
  const unique = [...new Set(paths.filter(Boolean))]
  if (!unique.length) return {}
  const { data, error } = await supabase.storage
    .from(SCREENSHOT_BUCKET)
    .createSignedUrls(unique, expiresIn)
  if (error) return {}
  const out = {}
  for (const row of data || []) {
    if (row.signedUrl && !row.error) out[row.path] = row.signedUrl
  }
  return out
}
