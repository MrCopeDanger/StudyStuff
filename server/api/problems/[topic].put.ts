import db from '../../utils/db'

export default defineEventHandler(async (event) => {
  const { topic } = event.context.params as { topic: string }
  if (!topic) return { error: 'missing topic' }
  const table = `problems_${topic}`

  const body = await readBody(event) as Record<string, unknown>
  const id = Number(body.id ?? 0)
  if (!id) return { error: 'missing id' }

  const allowed = ['prompt', 'model_solution', 'verified', 'verified_solution', 'difficulty', 'type', 'numeric_answer', 'equation_answer']
  const updates: string[] = []
  const params: unknown[] = []
  for (const key of allowed) {
    if (body[key] !== undefined) {
      updates.push(`${key} = ?`)
      params.push(body[key])
    }
  }

  if (updates.length === 0) return { error: 'no fields to update' }
  params.push(id)

  try {
    const stmt = db.prepare(`UPDATE ${table} SET ${updates.join(', ')} WHERE id = ?`)
    stmt.run(...params)
    return { ok: true }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err)
    return { error: 'failed to update problem', details: err instanceof Error ? err.stack : String(err) }
  }
})
