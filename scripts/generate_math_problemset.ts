// AI PROMPT ON LINE 203
import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'
import Database from 'better-sqlite3'
import { GoogleGenAI } from '@google/genai'

// Load .env from project root
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const GEMINI_KEY = process.env.GEMINI_API_KEY
if (!GEMINI_KEY) {
  console.error('GEMINI_API_KEY not found in environment. See README for run instructions.')
  process.exit(1)
}

const ai = new GoogleGenAI({ apiKey: GEMINI_KEY })

// Simple CLI args
const argv = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.split('=')
  return [k.replace(/^--/, ''), v ?? '']
})) as Record<string, string>

const count = Math.max(1, Number(argv.count || argv.c || 5))
const difficulty = (argv.difficulty || argv.d || 'easy')
const topic = String(argv.topic || argv.t || 'math')
const dbFile = path.resolve(process.cwd(), argv.db || 'problems.sqlite')

// Sanitize topic for use as table suffix: allow only letters, numbers and underscores
function sanitizeTopic(s: string) {
  return s.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'math'
}
const tableName = `problems_${sanitizeTopic(topic)}`

// Ensure DB file directory exists
const dbDir = path.dirname(dbFile)
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true })

const db = new Database(dbFile)

// Create table if missing
// Create per-topic table if missing. Table names are sanitized and built into the SQL string.
db.prepare(`
  CREATE TABLE IF NOT EXISTS ${tableName} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prompt TEXT NOT NULL,
    model_solution TEXT,
    verified INTEGER DEFAULT 0,
    verified_solution TEXT,
    difficulty TEXT,
    type TEXT,
    numeric_answer TEXT,
    equation_answer TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )
`).run()

// Ensure numeric_answer column exists for older tables
function ensureColumnExists(table: string, column: string, columnDef: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  const found = cols.some(c => c.name === column)
  if (!found) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${columnDef}`).run()
  }
}

ensureColumnExists(tableName, 'numeric_answer', 'TEXT')
ensureColumnExists(tableName, 'equation_answer', 'TEXT')

// Create a topics index table and ensure the current topic is recorded
db.prepare(`
  CREATE TABLE IF NOT EXISTS topics (
    name TEXT PRIMARY KEY,
    created_at TEXT DEFAULT (datetime('now')),
    last_updated TEXT
  )
`).run()

// Insert topic if missing, update last_updated
db.prepare(`INSERT OR IGNORE INTO topics (name) VALUES (?)`).run(sanitizeTopic(topic))
db.prepare(`UPDATE topics SET last_updated = datetime('now') WHERE name = ?`).run(sanitizeTopic(topic))

function safeEvaluateExpression(expr: string): { ok: boolean, value?: number, error?: string } {
  function toStr(e: unknown) {
    if (e instanceof Error) return e.message
    return String(e)
  }
  try {
    // Replace caret power with JS exponent
    const normalized = expr.replace(/\^/g, '**')
    // Allow only digits, operators, parentheses, decimal points, spaces, and * (from **)
    if (!/^[0-9+\-*/().\s]*$/.test(normalized)) {
      return { ok: false, error: 'Expression contains disallowed characters' }
    }

    const valueUnknown = Function(`"use strict"; return (${normalized})`)()
    if (typeof valueUnknown !== 'number' || !isFinite(valueUnknown)) {
      return { ok: false, error: 'Non-numeric result' }
    }
    return { ok: true, value: valueUnknown as number }
  } catch (err: unknown) {
    return { ok: false, error: toStr(err) }
  }
}

// Utility: attempt to extract JSON block from a string (code fences or balanced brackets)
function extractJsonBlockGlobal(s: string): string | null {
  if (!s) return null
  const fenceRe = /```(?:json)?\s*([\s\S]*?)```/i
  const fenceMatch = s.match(fenceRe)
  if (fenceMatch && fenceMatch[1]) return fenceMatch[1].trim()

  const firstIdx = s.indexOf('[')
  if (firstIdx !== -1) {
    let depth = 0
    for (let i = firstIdx; i < s.length; i++) {
      const ch = s[i]
      if (ch === '[') depth++
      else if (ch === ']') depth--
      if (depth === 0) return s.slice(firstIdx, i + 1)
    }
  }

  const objFirst = s.indexOf('{')
  if (objFirst !== -1) {
    let depth = 0
    for (let i = objFirst; i < s.length; i++) {
      const ch = s[i]
      if (ch === '{') depth++
      else if (ch === '}') depth--
      if (depth === 0) return s.slice(objFirst, i + 1)
    }
  }
  return null
}

// Validate model-generated array items strictly. Returns an array of error messages (empty = valid)
function validateGeneratedItems(arr: unknown, requestedCount: number, requestedDifficulty: string) {
  const errors: string[] = []
  if (!Array.isArray(arr)) {
    errors.push('Top-level value is not an array')
    return errors
  }
  if (arr.length !== requestedCount) {
    errors.push(`Expected ${requestedCount} items but got ${arr.length}`)
  }
  const allowedTypes = new Set(['arithmetic', 'algebra', 'word'])
  const allowedDiff = new Set(['easy', 'medium', 'hard'])

  arr.forEach((raw, i) => {
    const it = raw as Record<string, unknown>
    if (!it) {
      errors.push(`item[${i}]: not an object`)
      return
    }
    const prompt = typeof it.prompt === 'string' ? it.prompt.trim() : ''
    const solution = typeof it.solution === 'string' ? it.solution.trim() : ''
    const numeric = it.numeric_answer
    const equation = it.equation_answer ?? it.equasion_answer
    const type = typeof it.type === 'string' ? it.type.trim() : ''
    const diff = typeof it.difficulty === 'string' ? it.difficulty.trim() : ''

    if (!prompt || prompt.length < 5) errors.push(`item[${i}]: prompt missing or too short`)
    if (!solution) errors.push(`item[${i}]: solution missing`)

    // numeric_answer must be null or a number
    if (numeric !== null && numeric !== undefined && typeof numeric !== 'number') {
      // try coercing numeric-like strings is not allowed here
      errors.push(`item[${i}]: numeric_answer must be a JSON number or null`)
    }

    if (equation !== null && equation !== undefined && typeof equation !== 'string') {
      errors.push(`item[${i}]: equation_answer must be a string or null`)
    }

    if (!allowedTypes.has(type)) errors.push(`item[${i}]: type must be one of ${Array.from(allowedTypes).join(', ')}`)
    if (!allowedDiff.has(diff)) errors.push(`item[${i}]: difficulty must be one of easy, medium, hard`)
    else if (diff !== requestedDifficulty) {
      // require difficulty to match requested difficulty for stricter generation
      errors.push(`item[${i}]: difficulty '${diff}' does not match requested difficulty '${requestedDifficulty}'`)
    }

    // Extra checks by type
    if (type === 'arithmetic') {
      // prompt should look like a numeric expression (digits/operators, possibly equals)
      const expr = prompt
      if (!/^[0-9+\-*/().=\s^]+$/.test(expr)) errors.push(`item[${i}]: arithmetic prompt contains disallowed characters`)
      // don't allow variables in arithmetic prompts
      if (/[a-zA-Z]/.test(expr)) errors.push(`item[${i}]: arithmetic prompt contains letters`)
    }
    if (type === 'algebra') {
      // expect a single-letter variable like x or y in the prompt
      if (!/[a-zA-Z]/.test(prompt)) errors.push(`item[${i}]: algebra prompt should include a single-letter variable (e.g. x)`)
      // disallow multi-line long story problems in algebra for strictness
      if (prompt.split('\n').length > 1 || prompt.length > 200) errors.push(`item[${i}]: algebra prompt too long; keep concise and single-line`)
    }
  })

  return errors
}
// AI PROMPT
async function generateProblems(count: number, difficulty: string): Promise<Array<{ prompt: string, solution: string, numeric_answer?: number | null, equation_answer?: string | null, type?: string, difficulty?: string }>> {
  const prompt = `Generate ${count} concise, unambiguous math problems as a JSON array. Follow these rules EXACTLY and return ONLY valid JSON (no markdown, no commentary, no extra fields):

1) Output: a single JSON array with exactly ${count} objects.

2) Keep problems on topic and only generate problems related to the specified topic.

3) Schema for each object (keys and types):
  - prompt (string): the problem statement as a single-line, concise string (no multi-paragraph story problems).
  - solution (string): a short solution. If steps are included keep them concise and single-line or use a short step list joined with ' -> '.
  - numeric_answer (NUMBER or null): the final numeric value when applicable. MUST be a JSON NUMBER (not a string). Use null if not applicable.
  - equation_answer (STRING or null): when the correct answer is best given as an equation (e.g. "x = 2" or "2x+3=7"), provide it as a concise string. Use null otherwise.
  - type (string): one of ["arithmetic","algebra","word"].
  - difficulty (string): exactly one of ["easy","medium","hard"] and it MUST MATCH the requested difficulty.

4) Content constraints:
  - Keep prompts short (<= 120 characters) and single-line.
  - For "arithmetic": prompts must be numeric expressions using digits and operators only (digits, + - * / ^ ( ) and optional =). No variable names.
  - For "algebra": prompts should include a single-letter variable (x, y, etc.) and be concise. Variable names must be single letters.
  - For all problems: do not require external knowledge, avoid vague language, and avoid multi-step story context that is ambiguous.

5) Difficulty and ranges:
  - For "easy": use small integers (abs(value) <= 100) and simple operations.
  - For "medium": moderate integers (abs(value) <= 1000) and up to 2-3 steps.
  - For "hard": numbers and expressions up to abs(value) <= 10000 and more complex manipulations.

6) Examples (exact JSON objects):
  {"prompt":"2 + 3","solution":"5","numeric_answer":5,"equation_answer":null,"type":"arithmetic","difficulty":"easy"}
  {"prompt":"2x + 3 = 7","solution":"x = 2","numeric_answer":2,"equation_answer":"x = 2","type":"algebra","difficulty":"easy"}

Return EXACTLY a JSON array that conforms to the schema above.`

  // small helper to extract JSON block from noisy model output
  function extractJsonBlock(s: string): string | null {
    if (!s) return null
    const fenceRe = /```(?:json)?\s*([\s\S]*?)```/i
    const fenceMatch = s.match(fenceRe)
    if (fenceMatch && fenceMatch[1]) return fenceMatch[1].trim()

    const firstIdx = s.indexOf('[')
    if (firstIdx !== -1) {
      let depth = 0
      for (let i = firstIdx; i < s.length; i++) {
        const ch = s[i]
        if (ch === '[') depth++
        else if (ch === ']') depth--
        if (depth === 0) return s.slice(firstIdx, i + 1)
      }
    }

    const objFirst = s.indexOf('{')
    if (objFirst !== -1) {
      let depth = 0
      for (let i = objFirst; i < s.length; i++) {
        const ch = s[i]
        if (ch === '{') depth++
        else if (ch === '}') depth--
        if (depth === 0) return s.slice(objFirst, i + 1)
      }
    }
    return null
  }

  // helper to attempt parse+validate, returns parsed array or null
  function tryParseAndValidate(raw: string): Array<unknown> | null {
    try {
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return null
      const v = validateGeneratedItems(parsed, count, difficulty)
      if (v.length > 0) {
        console.warn('Validation errors:', v.join('; '))
        return null
      }
      return parsed
    } catch {
      return null
    }
  }

  // helper to write logs safely
  function safeWriteLog(filenameSuffix: string, content: string) {
    try {
      const logsDir = path.resolve(process.cwd(), 'logs')
      if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true })
      const p = path.join(logsDir, `${filenameSuffix}_${Date.now()}.txt`)
      fs.writeFileSync(p, content, 'utf8')
    } catch (e) { void e }
  }

  // Try series of prompts/attempts (initial, stricter, final strict with example)
  const attempts = [
    `${prompt}\nDifficulty: ${difficulty}`,
    `${prompt}\nDifficulty: ${difficulty}\nIMPORTANT: Output must be strictly valid JSON and nothing else. Respond with only JSON and nothing else.`,
    `${prompt}\nDifficulty: ${difficulty}\nFINAL INSTRUCTION: Return ONLY a single JSON array and nothing else. Use exactly the schema from the example and do not include any text or formatting. Example output:\n[{\n  "prompt": "2 + 3",\n  "solution": "5",\n  "numeric_answer": 5,\n  "equation_answer": null,\n  "type": "arithmetic",\n  "difficulty": "easy"\n}]`
  ]

  for (let attemptIdx = 0; attemptIdx < attempts.length; attemptIdx++) {
    const contents = attempts[attemptIdx]
    let respText = ''
    try {
      const res = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        generationConfig: { temperature: 0 },
        contents
      })
      respText = (res.text ?? '').trim()
    } catch (e) {
      // on model call error, continue to next attempt
      console.warn(`Model call failed on attempt ${attemptIdx + 1}:`, e)
      continue
    }

    // save raw output for debugging
    safeWriteLog(attemptIdx === 0 ? 'model_output' : attemptIdx === 1 ? 'model_retry_output' : 'model_final_retry_output', respText)
    console.log(`Model attempt ${attemptIdx + 1} preview:`, respText.slice(0, 1000))

    // 1) try raw parse+validate
    const rawParsed = tryParseAndValidate(respText)
    if (rawParsed) return rawParsed as Array<{ prompt: string, solution: string, numeric_answer?: number | null, equation_answer?: string | null, type?: string, difficulty?: string }>

    // 2) try extraction then parse+validate
    const extracted = extractJsonBlock(respText)
    if (extracted) {
      const parsedExtract = tryParseAndValidate(extracted)
      if (parsedExtract) return parsedExtract as Array<{ prompt: string, solution: string, numeric_answer?: number | null, equation_answer?: string | null, type?: string, difficulty?: string }>
      // otherwise warn and continue to next attempt
      console.warn('Extraction found but parsed/validation failed; will try next attempt if any.')
    } else {
      console.warn('No JSON block found in model output on attempt', attemptIdx + 1)
    }
    // proceed to next attempt
  }

  // If we reach here, all attempts failed
  throw new Error('Failed to parse and validate JSON array from model after multiple attempts; check logs/ for model output.')
}
type VerifyResult = { correct: boolean, correctSolution: string | null }
async function _verifyWithAI(problem: { prompt: string, solution: string }): Promise<VerifyResult> {
  const checkPrompt = `Problem: ${problem.prompt}\nProposed solution: ${problem.solution}\nIs the proposed solution correct? If yes, reply with JSON: {"correct": true, "correctSolution": "<solution>"}. If not, reply with JSON: {"correct": false, "correctSolution": "<correct solution or short explanation>"}. Return only JSON.`
  try {
    const r = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: checkPrompt })
    const text = r.text ?? ''
    const parsed = JSON.parse(text) as VerifyResult
    return parsed
  } catch (_err) {
    void _err
    // If parsing fails, return unverified
    return { correct: false, correctSolution: null }
  }
}

// Batch verify helper that accepts items and returns a Map from index -> VerifyResult
async function batchVerify(items: Array<{ idx: number, prompt: string, solution: string }>, batchSize = 5) {
  const resultsMap = new Map<number, { correct: boolean, correctSolution: string | null }>()
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize)
    const verifyPayload = chunk.map(it => ({ index: it.idx, prompt: it.prompt, solution: it.solution }))
    const vPrompt = `Verify the correctness of the following problems. Return ONLY a JSON array of objects with keys: index (the original index), correct (true/false), correctSolution (the correct answer or null).\nInput:\n${JSON.stringify(verifyPayload)}`
    try {
      const vRes = await ai.models.generateContent({ model: 'gemini-2.5-flash', generationConfig: { temperature: 0 }, contents: vPrompt })
      const vText = vRes.text?.trim() ?? ''
      // save raw
      try {
        const logPath = path.resolve(process.cwd(), 'logs', `verify_batch_${Date.now()}.txt`)
        fs.writeFileSync(logPath, vText, 'utf8')
      } catch (e) { void e }

      // parse
      try {
        const parsed = JSON.parse(vText) as unknown
        if (!Array.isArray(parsed)) throw new Error('expected array')
        ;(parsed as Array<unknown>).forEach((r) => {
          const obj = r as Record<string, unknown>
          resultsMap.set(Number(obj.index as number), { correct: Boolean(obj.correct as boolean), correctSolution: (obj.correctSolution as string) ?? null })
        })
      } catch (_err) {
        void _err
        // try extraction
        const extracted = extractJsonBlockGlobal(vText)
        if (extracted) {
          try {
            const parsed2 = JSON.parse(extracted) as Array<unknown>
            parsed2.forEach((r) => {
              const obj = r as Record<string, unknown>
              resultsMap.set(Number(obj.index as number), { correct: Boolean(obj.correct as boolean), correctSolution: (obj.correctSolution as string) ?? null })
            })
            continue
          } catch (_e2) { void _e2 }
        }
        // fallback: mark all as unverified
        chunk.forEach(it => resultsMap.set(it.idx, { correct: false, correctSolution: null }))
      }
    } catch (e) {
      // If the model call fails, mark chunk as unverified and continue
      chunk.forEach(it => resultsMap.set(it.idx, { correct: false, correctSolution: null }))
      void e
    }
  }
  return resultsMap
}

async function main() {
  console.log(`Generating ${count} problems (difficulty=${difficulty}) and storing in ${dbFile}`)
  const problems = await generateProblems(count, difficulty)

  const insert = db.prepare(`INSERT INTO ${tableName} (prompt, model_solution, verified, verified_solution, difficulty, type, numeric_answer, equation_answer) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)

  // Preprocess problems: attempt local verification for simple arithmetic and collect pending items for batch verification
  const processed: Array<{ promptText: string, modelSolution: string, type: string, difficulty: string, verified: number, verifiedSolution: string | null, numericAnswer: number | null, equationAnswer: string | null }> = []
  const pending: Array<{ idx: number, prompt: string, solution: string }> = []

  problems.forEach((p, idx) => {
    const promptText = String(p.prompt ?? p.question ?? '')
    const modelSolution = String(p.solution ?? '')
    const type = String(p.type ?? 'word')
    let verified = 0
    let verifiedSolution: string | null = null
    // Prefer an explicit numeric_answer field from the model output when provided
    let numericAnswer: number | null = (p.numeric_answer != null && !Number.isNaN(Number(p.numeric_answer))) ? Number(p.numeric_answer) : null
    // Accept either correctly spelled 'equation_answer' or a common misspelling 'equasion_answer'
    let equationAnswer: string | null = null
    if (p.equation_answer != null) equationAnswer = String(p.equation_answer)
    else if (p.equasion_answer != null) equationAnswer = String(p.equasion_answer)

    if (type === 'arithmetic') {
      let expr = promptText
      const eqIndex = promptText.indexOf('=')
      if (eqIndex !== -1) expr = promptText.slice(0, eqIndex)
      const simpleCheck = safeEvaluateExpression(expr)
      if (simpleCheck.ok) {
        // If the evaluated value matches a numeric token in the model solution, mark verified
        const numericSolution = Number(modelSolution.match(/-?\d+(?:\.\d+)?/)?.[0] ?? NaN)
        if (!Number.isNaN(numericSolution) && Math.abs(numericSolution - (simpleCheck.value ?? NaN)) < 1e-9) {
          verified = 1
          verifiedSolution = String(simpleCheck.value)
          numericAnswer = simpleCheck.value ?? null
        } else {
          // schedule for batch verification
          pending.push({ idx, prompt: promptText, solution: modelSolution })
        }
      } else {
        pending.push({ idx, prompt: promptText, solution: modelSolution })
      }
    } else {
      // non-arithmetic: schedule for batch verification
      pending.push({ idx, prompt: promptText, solution: modelSolution })
    }

    const difficultyFromModel = String(p.difficulty ?? difficulty)
    processed.push({ promptText, modelSolution, type, difficulty: difficultyFromModel, verified, verifiedSolution, numericAnswer, equationAnswer })
  })

  // Batch verify pending items in chunks
  // We now use the top-level batchVerify defined earlier

  if (pending.length > 0) {
    const batchResults = await batchVerify(pending, 5)
    // apply results
    batchResults.forEach((res, idx) => {
      const item = processed[idx]
      if (!item) return
      item.verified = res.correct ? 1 : 0
      item.verifiedSolution = res.correctSolution
      if (item.numericAnswer == null && res.correctSolution) {
        const m = String(res.correctSolution).match(/-?\d+(?:\.\d+)?/)
        if (m) item.numericAnswer = Number(m[0])
      }
    })
  }

  // Optionally re-check existing unverified problems in DB (CLI flag --recheck). Use AI verification if --ai-verify is passed.
  const recheckFlag = argv.recheck !== undefined || argv['recheck'] !== undefined || argv['check-existing'] !== undefined
  const aiVerifyFlag = argv['ai-verify'] !== undefined || argv['ai'] !== undefined || argv['enable-ai'] !== undefined

  if (recheckFlag) {
    console.log('Rechecking existing unverified problems in DB...')
    try {
      const unvRows = db.prepare(`SELECT id, prompt, model_solution FROM ${tableName} WHERE verified = 0`).all() as Array<Record<string, unknown>>
      const toCheck = unvRows.map(r => ({ idx: Number(r.id), prompt: String(r.prompt ?? ''), solution: String(r.model_solution ?? '') }))
      if (toCheck.length > 0) {
        if (aiVerifyFlag && typeof ai !== 'undefined') {
          const results = await batchVerify(toCheck, Number(argv['batch-size'] || 5))
          results.forEach((res, idx) => {
            const row = toCheck.find(t => t.idx === idx)
            if (!row) return
            db.prepare(`UPDATE ${tableName} SET verified = ?, verified_solution = ? WHERE id = ?`).run(res.correct ? 1 : 0, res.correctSolution, row.idx)
          })
        } else {
          // local numeric-only pass
          toCheck.forEach((r) => {
            const m = String(r.solution || '').match(/-?\d+(?:\.\d+)?/)
            const numeric = m ? Number(m[0]) : null
            if (numeric !== null) {
              // attempt to evaluate prompt expression
              const eqIndex = String(r.prompt).indexOf('=')
              let expr = String(r.prompt)
              if (eqIndex !== -1) expr = String(r.prompt).slice(0, eqIndex)
              const evalCheck = safeEvaluateExpression(expr)
              if (evalCheck.ok && evalCheck.value != null && Math.abs(evalCheck.value - numeric) < 1e-9) {
                db.prepare(`UPDATE ${tableName} SET verified = 1, verified_solution = ? WHERE id = ?`).run(String(numeric), r.idx)
              }
            }
          })
        }
      }
    } catch (e) { console.warn('Recheck failed:', e) }
  }

  // Insert all processed problems into DB
  for (const item of processed) {
    // final fallback: try to compute numericAnswer if still null
    if (item.numericAnswer == null && item.type === 'arithmetic') {
      const eqIndex2 = item.promptText.indexOf('=')
      let expr2 = item.promptText
      if (eqIndex2 !== -1) expr2 = item.promptText.slice(0, eqIndex2)
      const evalCheck = safeEvaluateExpression(expr2)
      if (evalCheck.ok) item.numericAnswer = evalCheck.value ?? null
    }

    try {
      insert.run(
        item.promptText,
        item.modelSolution,
        item.verified ? 1 : 0,
        item.verifiedSolution,
        item.difficulty ?? difficulty,
        item.type,
        item.numericAnswer,
        item.equationAnswer
      )
    } catch (e) {
      console.warn('Failed to insert problem into DB:', e)
    }
  }

  console.log('Done.')
  db.close()
}

await main()
