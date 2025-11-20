import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'
import Database from 'better-sqlite3'
import { GoogleGenAI } from '@google/genai'

// Load .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const GEMINI_KEY = process.env.GEMINI_API_KEY
if (!GEMINI_KEY) {
  console.error('GEMINI_API_KEY not found in environment. Set it in .env or environment variables.')
  process.exit(1)
}

const ai = new GoogleGenAI({ apiKey: GEMINI_KEY })

// CLI args
const argv = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.split('=')
  return [k.replace(/^--/, ''), v ?? '']
})) as Record<string, string>

const count = Math.max(1, Number(argv.count || argv.c || 5))
const difficulty = (argv.difficulty || argv.d || 'easy')
const topic = String(argv.topic || argv.t || 'graphs')
const dbFile = path.resolve(process.cwd(), argv.db || 'problems.sqlite')

function sanitizeTopic(s: string) {
  return s.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'graphs'
}
const tableName = `problems_graph_${sanitizeTopic(topic)}`

// Ensure DB directory
const dbDir = path.dirname(dbFile)
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true })
const db = new Database(dbFile)

// Create table
db.prepare(`
  CREATE TABLE IF NOT EXISTS ${tableName} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prompt TEXT NOT NULL,
    model_solution TEXT,
    difficulty TEXT,
    type TEXT,
    numeric_answer TEXT,
    equation_answer TEXT,
    desmos_expressions TEXT,
    choices TEXT,
    correct_index INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  )
`).run()
// Ensure topics index table exists and record this topic using the same suffix
// convention used by the app: topics.name should be the suffix after `problems_`.
const topicEntryName = `graph_${sanitizeTopic(topic)}`
db.prepare(`
CREATE TABLE IF NOT EXISTS topics (
name TEXT PRIMARY KEY,
created_at TEXT DEFAULT (datetime('now')),
last_updated TEXT
)
`).run()
// Insert or update the topic record so the server's /api/topics can find the table
db.prepare(`INSERT OR IGNORE INTO topics (name) VALUES (?)`).run(topicEntryName)
db.prepare(`UPDATE topics SET last_updated = datetime('now') WHERE name = ?`).run(topicEntryName)

function ensureColumnExists(table: string, column: string, columnDef: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  const found = cols.some(c => c.name === column)
  if (!found) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${columnDef}`).run()
  }
}

ensureColumnExists(tableName, 'desmos_expressions', 'TEXT')
ensureColumnExists(tableName, 'choices', 'TEXT')
ensureColumnExists(tableName, 'correct_index', 'INTEGER')

// Simple extractor
function extractJsonBlock(s: string): string | null {
  if (!s) return null
  const fenceRe = /```(?:json)?\s*([\s\S]*?)```/i
  const m = s.match(fenceRe)
  if (m && m[1]) return m[1].trim()
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
  return null
}

// Validator for graph MCQ items
function validateGraphItems(arr: unknown, requestedCount: number, requestedDifficulty: string) {
  const errors: string[] = []
  if (!Array.isArray(arr)) {
    errors.push('Top-level value is not an array')
    return errors
  }
  if (arr.length !== requestedCount) {
    errors.push(`Expected ${requestedCount} items but got ${arr.length}`)
  }

  arr.forEach((raw, i) => {
    const it = raw as Record<string, unknown>
    if (!it) {
      errors.push(`item[${i}]: not an object`)
      return
    }
    const prompt = typeof it.prompt === 'string' ? it.prompt.trim() : ''
    const solution = typeof it.solution === 'string' ? it.solution.trim() : ''
    const desmos = it.desmos_expressions
    const choices = it.choices
    const correct = it.correct_index
    const diff = typeof it.difficulty === 'string' ? it.difficulty.trim() : ''

    if (!prompt || prompt.length < 10) errors.push(`item[${i}]: prompt missing or too short`)
    if (!solution) errors.push(`item[${i}]: solution missing`)
    if (!Array.isArray(desmos) || desmos.length === 0) errors.push(`item[${i}]: desmos_expressions must be a non-empty array`)
    if (!Array.isArray(choices) || choices.length < 2) {
      errors.push(`item[${i}]: choices must be an array with >=2 options`)
    }
    if (typeof correct !== 'number' || Number(correct) < 0 || Number(correct) >= (Array.isArray(choices) ? choices.length : 0)) {
      errors.push(`item[${i}]: correct_index out of range`)
    }
    if (diff !== requestedDifficulty) {
      errors.push(`item[${i}]: difficulty '${diff}' does not match requested '${requestedDifficulty}'`)
    }
  })

  return errors
}

type GraphItem = {
  desmos_expressions: string[]
  prompt: string
  choices: string[]
  correct_index: number
  solution: string
  numeric_answer?: number | null
  equation_answer?: string | null
  type?: string
  difficulty?: string
}

async function generateGraphProblems(count: number, difficulty: string) {
  const prompt = `Generate ${count} multiple-choice graph interpretation problems with LaTeX expressions. Return a single JSON array with exactly ${count} objects. Each object must have these keys:
- desmos_expressions: an array of LaTeX expression strings using EXACT LaTeX syntax:
  * For absolute value: use \\\\left|x-3\\\\right|
  * For piecewise: use Desmos-style domain restrictions like: f(x) = \\\\{ x<=0 : x , x>0 : \\sin(x)\\\\} 
   IMPORTANT: always generate the innequality before the function.
  * For exponents: use x^2 or x^{2}
  * For inequalities: use <= >= < > symbols
- prompt: a concise question referring to the graph (single line).
- choices: an array of 3 or 4 short answer options (strings).
- correct_index: the zero-based index of the correct choice.
- solution: a short explanation string that clearly shows the calculation.
- numeric_answer: NUMBER or null - MUST be the exact numeric value of the correct answer, calculated precisely from the graph equation.
- equation_answer: STRING or null (if applicable).
- type: must be "graph".
- difficulty: one of "easy", "medium", "hard" and must match the requested difficulty.

IMPORTANT: For numeric_answer, calculate precisely:
- For y-intercepts of y=mx+b: use b (the constant term)
- For x-intercepts: solve the equation for when y=0
- For slopes: use the coefficient of x
- Double-check all calculations before generating the answer

IMPORTANT: Only generate graphs that are about ${topic}.

Constraints:
- Keep prompts single-line and concise (<=120 chars).
- For easy graphs, use simple lines and circles with small integer coefficients.
- For medium/hard, you may include piecewise, quadratics, or translations but keep graphs unambiguous.
- Choices must be mutually exclusive and plausible distractors.

Return ONLY valid JSON (no surrounding text). Example object:
{"desmos_expressions":["y=2x-2"],"prompt":"What is the y-intercept of the line shown?","choices":["-2","2","-1","1"],"correct_index":0,"solution":"y=2x-2 => y-intercept = -2","numeric_answer":-2,"equation_answer":null,"type":"graph","difficulty":"easy"}`

  // small helper to attempt parse+validate, returns parsed array or null
  function tryParseAndValidate(raw: string): Array<unknown> | null {
    try {
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return null
      const v = validateGraphItems(parsed, count, difficulty)
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

  const attempts = [
    `${prompt}\nDifficulty: ${difficulty}`,
    `${prompt}\nDifficulty: ${difficulty}\nIMPORTANT: Output must be strictly valid JSON and nothing else. Respond with only JSON and nothing else.`,
    `${prompt}\nDifficulty: ${difficulty}\nFINAL INSTRUCTION: Return ONLY a single JSON array and nothing else. Use exactly the schema from the example and do not include any text or formatting.`
  ]

  for (let attemptIdx = 0; attemptIdx < attempts.length; attemptIdx++) {
    const contents = attempts[attemptIdx]
    let respText = ''
    try {
      const res = await ai.models.generateContent({ model: 'gemini-2.5-flash', generationConfig: { temperature: 0 }, contents })
      respText = (res.text ?? '').trim()
    } catch (e) {
      console.warn(`Model call failed on attempt ${attemptIdx + 1}:`, e)
      continue
    }

    safeWriteLog(attemptIdx === 0 ? 'desmos_model_output' : attemptIdx === 1 ? 'desmos_model_retry' : 'desmos_model_final', respText)
    console.log(`Model attempt ${attemptIdx + 1} preview:`, respText.slice(0, 1000))

    // 1) try raw parse+validate
    const rawParsed = tryParseAndValidate(respText)
    if (rawParsed) return rawParsed as Array<GraphItem>

    // 2) try extraction then parse+validate
    const extracted = extractJsonBlock(respText)
    if (extracted) {
      const parsedExtract = tryParseAndValidate(extracted)
      if (parsedExtract) return parsedExtract as Array<GraphItem>
      console.warn('Extraction found but parsed/validation failed; will try next attempt if any.')
    } else {
      console.warn('No JSON block found in model output on attempt', attemptIdx + 1)
    }
    // proceed to next attempt
  }

  // If we reach here, all attempts failed
  throw new Error('Failed to parse and validate JSON array from model after multiple attempts; check logs/ for model output.')
}

// Add this function to extract and validate numeric answers
function extractCorrectNumericAnswer(prompt, solution, choices, correctIndex) {
  // First, try to get the answer from the correct choice
  if (Array.isArray(choices) && typeof correctIndex === 'number' && choices[correctIndex]) {
    const correctChoice = choices[correctIndex]
    const numFromChoice = parseFloat(correctChoice)
    if (!isNaN(numFromChoice)) {
      return numFromChoice
    }
  }

  // Try to extract from solution text
  const solutionNumbers = solution.match(/-?\d+(?:\.\d+)?/g)
  if (solutionNumbers && solutionNumbers.length > 0) {
    // Get the last number in the solution (usually the final answer)
    const lastNum = parseFloat(solutionNumbers[solutionNumbers.length - 1])
    if (!isNaN(lastNum)) {
      return lastNum
    }
  }

  // Try to extract from equation patterns like "y-intercept is -2" or "= -2"
  const interceptMatch = solution.match(/(?:intercept|answer|result|equals?)\s*(?:is|=)\s*(-?\d+(?:\.\d+)?)/i)
  if (interceptMatch) {
    const num = parseFloat(interceptMatch[1])
    if (!isNaN(num)) {
      return num
    }
  }

  return null
}

async function main() {
  console.log(`Generating ${count} graph MCQs (difficulty=${difficulty}) and storing in ${dbFile} table ${tableName}`)
  const items = await generateGraphProblems(count, difficulty)
  const insert = db.prepare(`INSERT INTO ${tableName} (prompt, model_solution, difficulty, type, numeric_answer, equation_answer, desmos_expressions, choices, correct_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)

  for (const it of items) {
    try {
      // Extract and validate the correct numeric answer
      const correctedNumericAnswer = extractCorrectNumericAnswer(
        it.prompt ?? '',
        it.solution ?? '',
        it.choices ?? [],
        it.correct_index ?? 0
      )

      // Log any corrections for debugging
      if (it.numeric_answer !== correctedNumericAnswer) {
        console.log(`Corrected answer for "${it.prompt}":`)
        console.log(`  AI generated: ${it.numeric_answer}`)
        console.log(`  Corrected to: ${correctedNumericAnswer}`)
        console.log(`  Solution: ${it.solution}`)
        console.log(`  Correct choice: ${it.choices?.[it.correct_index ?? 0]}`)
      }

      insert.run(
        String(it.prompt ?? ''),
        String(it.solution ?? ''),
        String(it.difficulty ?? difficulty),
        String(it.type ?? 'graph'),
        correctedNumericAnswer, // Use corrected answer
        it.equation_answer == null ? null : String(it.equation_answer),
        JSON.stringify(it.desmos_expressions ?? []),
        JSON.stringify(it.choices ?? []),
        it.correct_index == null ? null : Number(it.correct_index)
      )
    } catch (e) {
      console.warn('DB insert failed for item:', e)
    }
  }

  console.log('Done.')
  db.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
