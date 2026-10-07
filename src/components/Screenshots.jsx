import { useCallback, useEffect, useRef, useState } from 'react'
import { uploadScreenshot, removeScreenshot } from '../lib/storage'
import { deleteAttachmentByPath } from '../lib/api'
import { useSignedUrls } from '../lib/hooks'
import { useAuth } from '../context/AuthContext'
import { Lightbox } from './ui'

/**
 * Screenshot manager for a form. Files upload to Storage straight away so they
 * can be previewed; `paths` is the list the parent writes into `attachments`.
 *
 * Three ways in, because charts come from everywhere: the file picker (multi
 * select), dragging onto the box, and pasting straight from the clipboard
 * after a screen grab.
 */
export default function ScreenshotUploader({ paths, onChange, disabled }) {
  const { user } = useAuth()
  const [busy, setBusy] = useState(0)
  const [error, setError] = useState('')
  const [zoom, setZoom] = useState(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)
  const boxRef = useRef(null)
  const urls = useSignedUrls(paths)

  // Always append to the newest list, never the one captured when this
  // handler was created — two uploads in flight would otherwise lose one.
  const latest = useRef(paths)
  latest.current = paths

  const addFiles = useCallback(async (fileList) => {
    const files = [...(fileList || [])].filter((f) => f.type.startsWith('image/'))
    if (!files.length) return
    setError('')
    setBusy((b) => b + files.length)
    const failures = []

    for (const f of files) {
      try {
        const path = await uploadScreenshot(f, user.id)
        onChange([...latest.current, path])
        latest.current = [...latest.current, path]
      } catch (e) {
        failures.push(`${f.name}: ${e.message || 'upload failed'}`)
      } finally {
        setBusy((b) => Math.max(b - 1, 0))
      }
    }

    if (failures.length) setError(failures.join(' · '))
    if (inputRef.current) inputRef.current.value = ''
  }, [user, onChange])

  // paste a screenshot straight in
  useEffect(() => {
    if (disabled) return
    const onPaste = (e) => {
      const items = [...(e.clipboardData?.items || [])]
      const imgs = items.filter((i) => i.type.startsWith('image/'))
      if (!imgs.length) return
      e.preventDefault()
      addFiles(imgs.map((i) => i.getAsFile()).filter(Boolean))
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [addFiles, disabled])

  async function drop(path) {
    const next = latest.current.filter((p) => p !== path)
    latest.current = next
    onChange(next)
    // Unlink before deleting the object: if the form is cancelled afterwards,
    // no row is left pointing at a file that has already gone.
    await deleteAttachmentByPath(path)
    await removeScreenshot(path)
  }

  return (
    <div className="col" style={{ gap: 8 }}>
      <div
        ref={boxRef}
        className={`shots ${dragging ? 'dragging' : ''}`}
        onDragOver={(e) => { if (!disabled) { e.preventDefault(); setDragging(true) } }}
        onDragLeave={(e) => { if (e.target === boxRef.current) setDragging(false) }}
        onDrop={(e) => {
          if (disabled) return
          e.preventDefault()
          setDragging(false)
          addFiles(e.dataTransfer.files)
        }}
      >
        {paths.map((p, i) => (
          <div key={p} className="thumb" onClick={() => urls[p] && setZoom(urls[p])}>
            {urls[p]
              ? <img src={urls[p]} alt="" />
              : <div className="skeleton" style={{ height: '100%' }} />}
            <span className="thumb-n">{i + 1}</span>
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

        {Array.from({ length: busy }).map((_, i) => (
          <div className="thumb" key={`up-${i}`}>
            <div className="skeleton" style={{ height: '100%' }} />
          </div>
        ))}

        {!disabled && (
          <button
            type="button"
            className="thumb add"
            onClick={() => inputRef.current?.click()}
          >
            <span>＋</span>
            <span className="tiny">Add</span>
          </button>
        )}
      </div>

      {!disabled && (
        <div className="tiny faint">
          {paths.length > 0 && <><strong>{paths.length} attached</strong> · </>}
          Pick several at once, drag them in, or paste a screenshot with ⌘V.
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => addFiles(e.target.files)}
      />
      {error && <div className="alert error">{error}</div>}
      <Lightbox src={zoom} onClose={() => setZoom(null)} />
    </div>
  )
}
