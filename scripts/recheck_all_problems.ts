import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'
import Database from 'better-sqlite3'
import { GoogleGenAI } from '@google/genai'

// Load .env from project root (nuxt-app/.env expected)
dotenv.config({ path: path.resolve(process.cwd(), 'nuxt-app', '.env') })

const argv = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.split('=')
    return [k.replace(/^--/, ''), v ?? '']
  })
) as Record<string, string>

const useAI = argv.ai !== undefined || argv['ai-verify'] !== undefined
const batchSize = Number(argv['batch-size'] || argv['batch'] || 5)

// When running from the `nuxt-app` folder, the DB lives at ./problems.sqlite
const dbPath = path.resolve(process.cwd(), 'problems.sqlite')
if (!fs.existsSync(dbPath)) {
  console.error('Database not found at', dbPath)
  process.exit(1)
}

const db = new Database(dbPath)

// Discover topics: prefer topics table if present, otherwise scan sqlite_master
function listTopics(): string[] {
  try {
    const rows = db.prepare(`SELECT name FROM topics`).all() as Array<{ name: string }>
    if (rows && rows.length > 0) return rows.map(r => String(r.name))
  } catch {
    // ignore and fallback
  }
  const trows = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'problems_%'`).all() as Array<{ name: string }>
  return trows.map(r => String(r.name.replace(/^problems_/, '')))
}

// Simple safe evaluator for arithmetic expressions (same as generator)
function safeEvaluateExpression(expr: string): { ok: boolean, value?: number } {
  try {
    const normalized = expr.replace(/\^/g, '**')
    if (!/^[0-9+\-*/().\s]*$/.test(normalized)) return { ok: false }
    const value = Function(`"use strict"; return (${normalized})`)()
    if (typeof value !== 'number' || !isFinite(value)) return { ok: false }
    return { ok: true, value: value as number }
  } catch {
    return { ok: false }
  }
}

// Optional AI client
let ai: GoogleGenAI | null = null
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY || process.env.GENAI_KEY
if (useAI) {
  if (!GEMINI_KEY) {
    console.warn('--ai specified but GEMINI_API_KEY not found in nuxt-app/.env; proceeding with local checks only')
    ai = null
  } else {
    ai = new GoogleGenAI({ apiKey: GEMINI_KEY })
  }
}

async function batchVerifyWithAI(items: Array<{ id: number, prompt: string, solution: string }>, batchSize = 5) {
  const results = new Map<number, { correct: boolean, correctSolution: string | null }>()
  if (!ai) {
    items.forEach(it => results.set(it.id, { correct: false, correctSolution: null }))
    return results
  }

  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize)
    const payload = chunk.map(c => ({ id: c.id, prompt: c.prompt, solution: c.solution }))
    const vPrompt = `Verify the correctness of these problems. Return ONLY a JSON array of objects with fields: id, correct (true/false), correctSolution (the correct answer or null).\nInput:\n${JSON.stringify(payload)}`
    try {
      const model = ai.getGenerativeModel({ model: 'gemini-pro' })
      const res = await model.generateContent(vPrompt)
      const text = res.text?.trim() ?? ''
      // save raw
      try {
        const logsDir = path.resolve(process.cwd(), 'nuxt-app', 'logs')
        if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true })
        fs.writeFileSync(path.join(logsDir, `recheck_batch_${Date.now()}.txt`), text, 'utf8')
      } catch {
        // ignore
      }

      let parsed: unknown = null
      try {
        parsed = JSON.parse(text)
      } catch {
        parsed = null
      }

      if (!Array.isArray(parsed)) {
        // try to extract array portion
        const first = text.indexOf('[')
        const last = text.lastIndexOf(']')
        if (first !== -1 && last !== -1 && last > first) {
          try {
            parsed = JSON.parse(text.slice(first, last + 1))
          } catch {
            parsed = null
          }
        }
      }

      if (Array.isArray(parsed)) {
        parsed.forEach((o: unknown) => {
          const obj = o as Record<string, unknown>
          const id = Number(obj.id)
          results.set(id, { correct: Boolean(obj.correct), correctSolution: obj.correctSolution == null ? null : String(obj.correctSolution) })
        })
      } else {
        // fallback: mark as unverified
        chunk.forEach(c => results.set(c.id, { correct: false, correctSolution: null }))
      }
    } catch (err) {
      chunk.forEach(c => results.set(c.id, { correct: false, correctSolution: null }))
      void err
    }
  }
  return results
}

async function recheckTopic(topic: string) {
  const table = `problems_${topic}`
  console.log(`\nRechecking topic: ${topic} (table ${table})`)
  try {
    const rows = db.prepare(`SELECT id, prompt, model_solution FROM ${table} WHERE verified = 0`).all() as Array<Record<string, unknown>>
    if (!rows || rows.length === 0) {
      console.log('  No unverified rows')
      return
    }

    // First pass: local numeric-only checks
    const remaining: Array<{ id: number, prompt: string, solution: string }> = []
    let numAuto = 0
    for (const r of rows) {
      const id = Number(r.id)
      const prompt = String(r.prompt ?? '')
      const sol = String(r.model_solution ?? '')
      const m = sol.match(/-?\d+(?:\.\d+)?/)
      const numeric = m ? Number(m[0]) : null
      if (numeric != null) {
        // attempt to evaluate prompt (strip RHS if contains =)
        const eq = prompt.indexOf('=')
        let expr = prompt
        if (eq !== -1) expr = prompt.slice(0, eq)
        const ev = safeEvaluateExpression(expr)
        if (ev.ok && ev.value != null && Math.abs(ev.value - numeric) < 1e-9) {
          db.prepare(`UPDATE ${table} SET verified = 1, verified_solution = ? WHERE id = ?`).run(String(numeric), id)
          numAuto++
          continue
        }
      }
      remaining.push({ id, prompt, solution: sol })
    }

    console.log(`  Auto-verified (numeric) count: ${numAuto}. Remaining: ${remaining.length}`)

    if (remaining.length > 0 && useAI && ai) {
      console.log(`  Performing AI batch verification (batch size ${batchSize})...`)
      const results = await batchVerifyWithAI(remaining, batchSize)
      let updated = 0
      results.forEach((res, id) => {
        const row = remaining.find(r => r.id === id)
        if (!row) return
        db.prepare(`UPDATE ${table} SET verified = ?, verified_solution = ? WHERE id = ?`).run(res.correct ? 1 : 0, res.correctSolution, id)
        updated++
      })
      console.log(`  AI-updated rows: ${updated}`)
    }
  } catch (err) {
    console.warn('  Failed to recheck topic', topic, err)
  }
}

async function main() {
  const topics = listTopics()
  if (!topics || topics.length === 0) {
    console.log('No topics found to recheck.')
    process.exit(0)
  }

  console.log('Topics to recheck:', topics.join(', '))

  for (const t of topics) {
    await recheckTopic(t)
  }

  console.log('\nRecheck complete.')
  db.close()
}

main().catch((err) => {
  console.error('Fatal error:', err)
  if (db) db.close()
  process.exit(1)
})
