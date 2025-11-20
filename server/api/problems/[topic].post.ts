import db from '../../utils/db'

export default defineEventHandler(async (event) => {
  const { topic } = event.context.params as { topic: string }
  if (!topic) return { error: 'missing topic' }
  const table = `problems_${topic}`

  const body = await readBody(event) as Record<string, unknown>
  const prompt = String(body.prompt ?? '')
  const model_solution = String(body.model_solution ?? '')
  const verified = Number(body.verified ?? 0)
  const verified_solution = body.verified_solution == null ? null : String(body.verified_solution)
  const difficulty = String(body.difficulty ?? '')
  const type = String(body.type ?? '')
  const numeric_answer = body.numeric_answer == null ? null : Number(body.numeric_answer)
  const equation_answer = body.equation_answer == null ? null : String(body.equation_answer)

  try {
    db.prepare(`INSERT INTO ${table} (prompt, model_solution, verified, verified_solution, difficulty, type, numeric_answer, equation_answer) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(prompt, model_solution, verified, verified_solution, difficulty, type, numeric_answer, equation_answer)
    return { ok: true }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err)
    return { error: 'failed to insert problem', details: err instanceof Error ? err.stack : String(err) }
  }
})
