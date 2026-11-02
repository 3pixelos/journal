import { supabase } from './supabase'
import { listMyScreenshots } from './storage'

/** Replace the tag links on a trade or journal entry. */
export async function syncTags({ table, column, id, tagIds }) {
  const { data: existing } = await supabase.from(table).select('tag_id').eq(column, id)
  const have = new Set((existing || []).map((r) => r.tag_id))
  const want = new Set(tagIds)

  const toAdd = [...want].filter((t) => !have.has(t))
  const toRemove = [...have].filter((t) => !want.has(t))

  if (toAdd.length) {
    await supabase.from(table).insert(toAdd.map((tag_id) => ({ [column]: id, tag_id })))
  }
  if (toRemove.length) {
    await supabase.from(table).delete().eq(column, id).in('tag_id', toRemove)
  }
}

/**
 * Point a set of storage paths at a trade and/or journal entry.
 *
 * Keyed on storage_path (which is UNIQUE) rather than blind-inserting, because a
 * screenshot can start life attached to a trade and later gain a journal entry —
 * re-inserting it would violate that constraint.
 */
export async function syncAttachments({
  userId, tradeId = null, journalEntryId = null, backtestTradeId = null, paths,
}) {
  // One object for every write below. A screenshot that is written with the
  // parent columns spelled out twice is a screenshot that gets orphaned the
  // day a fourth parent is added, and an orphan looks exactly like a lost file.
  const parent = {
    trade_id: tradeId,
    journal_entry_id: journalEntryId,
    backtest_trade_id: backtestTradeId,
  }
  const parentCol = backtestTradeId ? 'backtest_trade_id'
    : journalEntryId ? 'journal_entry_id'
    : 'trade_id'
  const parentId = parent[parentCol]
  if (!parentId) return

  const { data: current, error: readErr } = await supabase
    .from('attachments')
    .select('id, storage_path')
    .eq(parentCol, parentId)
  if (readErr) throw readErr

  const currentPaths = new Set((current || []).map((r) => r.storage_path))
  const want = new Set(paths)

  const toRemove = (current || []).filter((r) => !want.has(r.storage_path)).map((r) => r.id)
  if (toRemove.length) {
    const { error: err } = await supabase.from('attachments').delete().in('id', toRemove)
    if (err) throw err
  }

  const missing = paths.filter((p) => !currentPaths.has(p))
  if (!missing.length) return

  // Some of these rows may already exist under the other parent column.
  const { data: existing, error: dupErr } = await supabase
    .from('attachments')
    .select('id, storage_path')
    .in('storage_path', missing)
  if (dupErr) throw dupErr
  const idByPath = new Map((existing || []).map((r) => [r.storage_path, r.id]))

  const toRelink = missing.filter((p) => idByPath.has(p)).map((p) => idByPath.get(p))
  const toInsert = missing.filter((p) => !idByPath.has(p))

  if (toRelink.length) {
    const { error: err } = await supabase
      .from('attachments')
      .update(parent)
      .in('id', toRelink)
    if (err) throw err
  }
  if (toInsert.length) {
    const { error: err } = await supabase.from('attachments').insert(
      toInsert.map((storage_path) => ({ user_id: userId, storage_path, ...parent }))
    )
    if (err) throw err
  }
}

/**
 * Screenshots sitting in Storage that no trade, journal entry or demo trade
 * claims — either uploaded into a form that was never saved, or orphaned by
 * a write that forgot to record its parent.
 *
 * A row whose parent columns are all null counts as unattached: the file is
 * logged but points at nothing, which is exactly how a chart goes missing.
 */
export async function listLooseCharts(userId) {
  const [files, { data: rows, error }] = await Promise.all([
    listMyScreenshots(userId),
    supabase
      .from('attachments')
      .select('storage_path, trade_id, journal_entry_id, backtest_trade_id')
      .eq('user_id', userId),
  ])
  if (error) throw error

  const claimed = new Set(
    (rows || [])
      .filter((r) => r.trade_id || r.journal_entry_id || r.backtest_trade_id)
      .map((r) => r.storage_path)
  )
  return files.filter((f) => !claimed.has(f.path))
}

/** Point one screenshot that already exists in Storage at a parent. */
export async function linkChart({ userId, path, tradeId = null, journalEntryId = null, backtestTradeId = null }) {
  const parent = {
    trade_id: tradeId,
    journal_entry_id: journalEntryId,
    backtest_trade_id: backtestTradeId,
  }
  // storage_path is unique, so an orphan row is updated rather than duplicated.
  const { data: row, error: readErr } = await supabase
    .from('attachments').select('id').eq('storage_path', path).maybeSingle()
  if (readErr) throw readErr

  const { error } = row
    ? await supabase.from('attachments').update(parent).eq('id', row.id)
    : await supabase.from('attachments').insert({ user_id: userId, storage_path: path, ...parent })
  if (error) throw error
}

/** Drop the row for one screenshot immediately, so a cancelled form cannot leave
 *  a record pointing at a file that is already gone from Storage. */
export async function deleteAttachmentByPath(storagePath) {
  await supabase.from('attachments').delete().eq('storage_path', storagePath)
}

/** Load attachment paths for a set of parents. Returns { parentId: [path] }. */
export async function loadAttachments(column, ids) {
  if (!ids.length) return {}
  const { data, error } = await supabase
    .from('attachments')
    .select(`id, storage_path, ${column}`)
    .in(column, ids)
  // A read that fails should cost you the thumbnails, not the page they sit on.
  if (error) console.error('loadAttachments', column, error.message)
  const out = {}
  for (const row of data || []) {
    const k = row[column]
    ;(out[k] ||= []).push(row.storage_path)
  }
  return out
}

/** Load tag ids for a set of parents. Returns { parentId: [tagId] }. */
export async function loadTagLinks(table, column, ids) {
  if (!ids.length) return {}
  const { data } = await supabase.from(table).select(`${column}, tag_id`).in(column, ids)
  const out = {}
  for (const row of data || []) {
    ;(out[row[column]] ||= []).push(row.tag_id)
  }
  return out
}

export async function deleteTrade(id) {
  // attachments cascade in Postgres; storage objects are cleaned up here.
  const { data: files } = await supabase.from('attachments').select('storage_path').eq('trade_id', id)
  await supabase.from('trades').delete().eq('id', id)
  return (files || []).map((f) => f.storage_path)
}

export async function deleteJournalEntry(id) {
  const { data: files } = await supabase
    .from('attachments')
    .select('storage_path')
    .eq('journal_entry_id', id)
  await supabase.from('journal_entries').delete().eq('id', id)
  return (files || []).map((f) => f.storage_path)
}
