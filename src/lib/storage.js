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
