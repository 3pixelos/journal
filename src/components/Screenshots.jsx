import { useRef, useState } from 'react'
import { uploadScreenshot, removeScreenshot } from '../lib/storage'
import { deleteAttachmentByPath } from '../lib/api'
import { useSignedUrls } from '../lib/hooks'
import { useAuth } from '../context/AuthContext'
import { Lightbox } from './ui'

/**
 * Drop-in screenshot manager for a form. Files go to Storage immediately so we
 * can preview them; `paths` is the list the parent saves into `attachments`.
 */
export default function ScreenshotUploader({ paths, onChange, disabled }) {
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [zoom, setZoom] = useState(null)
  const inputRef = useRef(null)
  const urls = useSignedUrls(paths)

  async function handleFiles(fileList) {
    const files = [...fileList]
    if (!files.length) return
    setBusy(true)
    setError('')
    const added = []
    try {
      for (const f of files) {
        added.push(await uploadScreenshot(f, user.id))
      }
      onChange([...paths, ...added])
    } catch (e) {
      setError(e.message || 'Upload failed.')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function drop(path) {
    onChange(paths.filter((p) => p !== path))
    // Unlink before deleting the object: if the user cancels the form afterwards,
    // we must not leave a row pointing at a file that no longer exists.
    await deleteAttachmentByPath(path)
    await removeScreenshot(path)
  }

  return (
    <div className="col" style={{ gap: 8 }}>
      <div className="thumbs">
        {paths.map((p) => (
          <div key={p} className="thumb" onClick={() => urls[p] && setZoom(urls[p])}>
            {urls[p] ? <img src={urls[p]} alt="" /> : <div className="skeleton" style={{ height: '100%' }} />}
            {!disabled && (
              <button
                type="button"
                className="x"
                onClick={(e) => { e.stopPropagation(); drop(p) }}
                aria-label="Remove screenshot"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        {!disabled && (
          <button
            type="button"
            className="thumb"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            style={{ display: 'grid', placeItems: 'center', color: 'var(--muted)', cursor: 'pointer' }}
          >
            {busy ? '…' : '＋ Add'}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
      {error && <div className="alert error">{error}</div>}
      <Lightbox src={zoom} onClose={() => setZoom(null)} />
    </div>
  )
}
