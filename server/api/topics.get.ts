import db from '../utils/db'

export default defineEventHandler(async () => {
  // Ensure topics table exists (in case DB was created elsewhere)
  db.prepare(`
    CREATE TABLE IF NOT EXISTS topics (
      name TEXT PRIMARY KEY,
      created_at TEXT DEFAULT (datetime('now')),
      last_updated TEXT
    )
  `).run()

  const topics = db.prepare('SELECT name, created_at, last_updated FROM topics').all() as Array<{ name: string, created_at: string, last_updated: string }>

  // Enumerate existing problems_* tables so we can robustly match topic rows to the actual table names.
  const existing = db.prepare('SELECT name FROM sqlite_master WHERE type=\'table\' AND name LIKE \'problems_%\'').all() as Array<{ name: string }>
  const existingNames = existing.map(r => r.name)

  // If the topics table doesn't contain entries for discovered problem tables,
  // merge discovered suffixes so the UI can show them even if the topics table
  // was never populated (e.g. generator wrote to a different DB file).
  if (topics.length === 0 && existingNames.length > 0) {
    // create synthetic topic rows using the suffix after 'problems_'
    for (const n of existingNames) {
      const suffix = n.startsWith('problems_') ? n.slice('problems_'.length) : n
      topics.push({ name: suffix, created_at: null as unknown as string, last_updated: null as unknown as string })
    }
  } else if (existingNames.length > 0) {
    // Add any discovered suffixes that are missing from the topics table
    const known = new Set(topics.map(t => t.name))
    for (const n of existingNames) {
      const suffix = n.startsWith('problems_') ? n.slice('problems_'.length) : n
      if (!known.has(suffix)) topics.push({ name: suffix, created_at: null as unknown as string, last_updated: null as unknown as string })
    }
  }

  const results = topics.map((t) => {
    const candidates = [
      `problems_${t.name}`,
      `problems_graph_${t.name}`,
      `problems_${t.name.replace(/^graph_/, '')}`
    ]

    // choose a table name using a few strategies: exact candidate, suffix match, include match
    let tableName: string | null = null
    tableName = existingNames.find(n => candidates.includes(n)) ?? null
    if (!tableName) tableName = existingNames.find(n => n.endsWith(`_${t.name}`)) ?? null
    if (!tableName) tableName = existingNames.find(n => n.includes(t.name)) ?? null
    tableName = existingNames.find(n => candidates.includes(n)) ?? null
    if (!tableName) tableName = existingNames.find(n => n.endsWith(`_${t.name}`)) ?? null
    if (!tableName) tableName = existingNames.find(n => n.includes(t.name)) ?? null

    if (!tableName) return { name: t.name, created_at: t.created_at, last_updated: t.last_updated, count: 0 }

    try {
      const row = db.prepare(`SELECT COUNT(*) as c FROM ${tableName}`).get() as { c: number }
      return { name: t.name, created_at: t.created_at, last_updated: t.last_updated, count: row?.c ?? 0 }
    } catch (err) {
      console.error('Failed to count rows for table ' + tableName + ':', err)
      return { name: t.name, created_at: t.created_at, last_updated: t.last_updated, count: 0 }
    }
  })

  return results
})
