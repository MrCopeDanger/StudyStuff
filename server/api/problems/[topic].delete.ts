import db from '../../utils/db'

export default defineEventHandler(async (event) => {
  const { topic } = event.context.params as { topic: string }
  if (!topic) return { error: 'missing topic' }
  const table = `problems_${topic}`

  const body = await readBody(event) as Record<string, unknown>
  const id = Number(body.id ?? 0)
  if (!id) return { error: 'missing id' }

  try {
    db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id)
    return { ok: true }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err)
    return { error: 'failed to delete problem', details: err instanceof Error ? err.stack : String(err) }
  }
})
