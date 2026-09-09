import { supabase } from './supabase'

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
export async function syncAttachments({ userId, tradeId = null, journalEntryId = null, paths }) {
  const parentCol = journalEntryId ? 'journal_entry_id' : 'trade_id'
  const parentId = journalEntryId || tradeId
  if (!parentId) return

  const { data: current } = await supabase
    .from('attachments')
    .select('id, storage_path')
    .eq(parentCol, parentId)

  const currentPaths = new Set((current || []).map((r) => r.storage_path))
  const want = new Set(paths)

  const toRemove = (current || []).filter((r) => !want.has(r.storage_path)).map((r) => r.id)
  if (toRemove.length) await supabase.from('attachments').delete().in('id', toRemove)

  const missing = paths.filter((p) => !currentPaths.has(p))
  if (!missing.length) return

  // Some of these rows may already exist under the other parent column.
  const { data: existing } = await supabase
    .from('attachments')
    .select('id, storage_path')
    .in('storage_path', missing)
  const idByPath = new Map((existing || []).map((r) => [r.storage_path, r.id]))

  const toRelink = missing.filter((p) => idByPath.has(p)).map((p) => idByPath.get(p))
  const toInsert = missing.filter((p) => !idByPath.has(p))

  if (toRelink.length) {
    await supabase
      .from('attachments')
      .update({ trade_id: tradeId, journal_entry_id: journalEntryId })
      .in('id', toRelink)
  }
  if (toInsert.length) {
    await supabase.from('attachments').insert(
      toInsert.map((storage_path) => ({
        user_id: userId,
        trade_id: tradeId,
        journal_entry_id: journalEntryId,
        storage_path,
      }))
    )
  }
}

/** Drop the row for one screenshot immediately, so a cancelled form cannot leave
 *  a record pointing at a file that is already gone from Storage. */
export async function deleteAttachmentByPath(storagePath) {
  await supabase.from('attachments').delete().eq('storage_path', storagePath)
}

/** Load attachment paths for a set of parents. Returns { parentId: [path] }. */
export async function loadAttachments(column, ids) {
  if (!ids.length) return {}
  const { data } = await supabase
    .from('attachments')
    .select(`id, storage_path, ${column}`)
    .in(column, ids)
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
