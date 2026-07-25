/**
 * Supabase Storage helpers for cover art.
 * Images are stored at covers/{userId}/{releaseId}.{ext}
 */
import { supabase } from './supabase'

const BUCKET = 'covers'

/**
 * Upload a cover image file for a release.
 * Uses upsert so re-uploading a cover for the same release replaces it.
 * Returns the public URL for the stored image.
 */
export async function uploadCoverImage(
  userId: string,
  releaseId: string,
  file: File,
): Promise<string> {
  const ext = file.type.includes('png') ? 'png' : 'jpg'
  const path = `${userId}/${releaseId}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type,
  })
  if (error) throw error

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

/**
 * Best-effort delete of all possible cover variants for a release.
 * Silently ignores errors (file may not exist if no cover was uploaded).
 */
export async function deleteCoverImage(
  userId: string,
  releaseId: string,
): Promise<void> {
  const paths = ['jpg', 'jpeg', 'png', 'webp'].map(
    (ext) => `${userId}/${releaseId}.${ext}`,
  )
  await supabase.storage.from(BUCKET).remove(paths)
}
