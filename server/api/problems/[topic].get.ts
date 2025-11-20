import db from '../../utils/db'

export default defineEventHandler(async (event) => {
  const { topic } = event.context.params as { topic: string }
  if (!topic) return { error: 'missing topic' }
  // pagination
  const query = getQuery(event)
  const limit = Number(query.limit || 50)
  const offset = Number(query.offset || 0)
  // Try multiple table name patterns in case topics were recorded differently
  const candidates = [
    `problems_${topic}` // For topics like "graph_quadratics" -> "problems_graph_quadratics"
  // Remove the second candidate that adds extra "graph_"
  // Only use the strip logic for actual fallback
  ]

  // enumerate existing problem tables and pick the best match
  const existing = db.prepare('SELECT name FROM sqlite_master WHERE type=\'table\' AND name LIKE \'problems_%\'').all() as Array<{ name: string }>
  const existingNames = existing.map(r => r.name)
  let tableName: string | null = null
  tableName = existingNames.find(n => candidates.includes(n)) ?? null
  if (!tableName) tableName = existingNames.find(n => n.endsWith(`_${topic}`)) ?? null
  if (!tableName) tableName = existingNames.find(n => n.includes(topic)) ?? null

  if (!tableName) {
    // no matching table found; return empty array so UI shows 'no problems'
    // but log details for debugging
    console.warn('No problems table matched for topic:', topic, 'candidates:', candidates, 'existing:', existingNames)
    return []
  }

  try {
    const rows = db.prepare(`SELECT * FROM ${tableName} ORDER BY id DESC LIMIT ? OFFSET ?`).all(limit, offset)
    // log the matched table and row count for dev visibility

    console.log(`Serving ${rows.length} rows from table ${tableName} for topic ${topic}`)
    return rows
  } catch (err) {
    console.error(err)
    return { error: 'failed to read problems for topic', details: err instanceof Error ? err.stack : String(err) }
  }
})
