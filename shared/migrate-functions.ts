// scripts/migrate-functions.ts
import Database from 'better-sqlite3'
import { Client } from '@notionhq/client'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

// Load environment variables
config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

console.log('🏁 Migration script starting...')
console.log('📁 Working directory:', process.cwd())

// Types for Notion API responses
interface NotionPage {
  id: string
  properties: Record<string, NotionProperty>
}

interface NotionProperty {
  type: string
  title?: Array<{ plain_text: string }>
  rich_text?: Array<{ plain_text: string }>
  select?: { name: string }
}

interface NotionQueryResponse {
  results: NotionPage[]
  has_more: boolean
  next_cursor: string | null
}

interface NewFunctionsProblem {
  id: string
  problemStatement: string | null
  answer: string | null
  difficulty: string | null
  explanation: string | null
  topic: string | null
}

class FunctionsDatabaseMigrator {
  private notion: Client
  private db: Database.Database

  constructor(notionToken: string, sqlitePath: string = './functions-problems.db') {
    console.log('🔧 Initializing migrator...')
    console.log('📁 Database path:', resolve(sqlitePath))

    this.notion = new Client({
      auth: notionToken
    })
    this.db = new Database(sqlitePath)
    console.log('✅ Migrator initialized')
  }

  async migrate(): Promise<void> {
    const databaseId = '2abb1f6bac1e497e917a60b592d141c9'

    console.log('🔍 Database ID:', databaseId)

    try {
      console.log('🚀 Starting Functions database migration...')

      this.createTable()
      await this.migrateProblems(databaseId)
      await this.generateStats()

      console.log('✅ Migration completed successfully!')
    } catch (error) {
      console.error('❌ Migration failed:', error)
      throw error
    }
  }

  private createTable(): void {
    console.log('🔨 Creating functions_problems table...')

    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS functions_problems (
        id TEXT PRIMARY KEY,
        problem_statement TEXT,
        answer TEXT,
        difficulty TEXT CHECK(difficulty IN ('Easy', 'Medium', 'Hard')),
        explanation TEXT,
        topic TEXT CHECK(topic IN (
          'Domain and Range', 
          'Zeros and Intercepts', 
          'Max/Min Values', 
          'Increasing/Decreasing', 
          'End Behavior', 
          'Transformations', 
          'Symmetry', 
          'Asymptotes', 
          'Continuity', 
          'Vertex'
        )),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `

    this.db.exec(createTableSQL)
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_difficulty ON functions_problems(difficulty)')
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_topic ON functions_problems(topic)')

    console.log('✅ Table created successfully')
  }

  private async migrateProblems(databaseId: string): Promise<void> {
    let cursor: string | undefined
    let totalCount = 0

    console.log('📝 Starting to migrate problems from Notion...')
    console.log('🔗 Using database ID:', databaseId)

    try {
      do {
        console.log('🔄 Fetching batch from Notion...')

        // Using the proper Notion SDK method
        const response = await this.notion.databases.query({
          database_id: databaseId,
          start_cursor: cursor,
          page_size: 100
        })

        console.log(`📦 Received ${response.results.length} pages in this batch`)

        const problems = response.results
          .filter((page): page is NotionPage => 'properties' in page)
          .map((page) => {
            const extracted = this.extractProblemData(page)
            console.log(`📄 Extracted: "${extracted.problemStatement?.substring(0, 50) || 'No title'}..."`)
            return extracted
          })

        if (problems.length > 0) {
          console.log(`💾 Inserting ${problems.length} problems into database...`)
          this.insertProblems(problems)
          totalCount += problems.length
          console.log(`📊 Total migrated so far: ${totalCount} problems`)
        }

        cursor = response.next_cursor || undefined
        console.log('🔄 Next cursor:', cursor ? 'exists' : 'null (done)')
      } while (cursor)

      console.log(`🎉 Successfully migrated ${totalCount} problems!`)
    } catch (error) {
      console.error('💥 Error during migration:', error)
      throw error
    }
  }

  private extractProblemData(page: NotionPage): NewFunctionsProblem {
    const properties = page.properties

    return {
      id: page.id,
      problemStatement: this.extractText(properties['Problem Statement']),
      answer: this.extractText(properties['Answer']),
      difficulty: this.extractSelect(properties['Difficulty']),
      explanation: this.extractText(properties['Explanation']),
      topic: this.extractSelect(properties['Topic'])
    }
  }

  private extractText(property: NotionProperty | undefined): string | null {
    if (!property) return null

    try {
      if (property.type === 'title' && property.title) {
        return property.title.map(t => t.plain_text).join('')
      }

      if (property.type === 'rich_text' && property.rich_text) {
        return property.rich_text.map(t => t.plain_text).join('')
      }
    } catch (error) {
      console.error('❌ Error extracting text:', error)
    }

    return null
  }

  private extractSelect(property: NotionProperty | undefined): string | null {
    if (!property?.select) return null
    return property.select.name
  }

  private insertProblems(problems: NewFunctionsProblem[]): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO functions_problems 
      (id, problem_statement, answer, difficulty, explanation, topic, created_at) 
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `)

    const transaction = this.db.transaction((problemList: NewFunctionsProblem[]) => {
      for (const problem of problemList) {
        stmt.run(
          problem.id,
          problem.problemStatement,
          problem.answer,
          problem.difficulty,
          problem.explanation,
          problem.topic
        )
      }
    })

    transaction(problems)
    console.log('✅ Problems inserted successfully')
  }

  private async generateStats(): Promise<void> {
    console.log('\n📊 Generating Database Statistics...')
    console.log('='.repeat(50))

    const totalResult = this.db.prepare('SELECT COUNT(*) as count FROM functions_problems').get() as { count: number }
    console.log(`📈 Total Problems: ${totalResult.count}`)

    if (totalResult.count === 0) {
      console.log('⚠️ No problems found in database. Something went wrong during migration.')
      return
    }

    const difficultyStats = this.db.prepare(`
      SELECT difficulty, COUNT(*) as count 
      FROM functions_problems 
      WHERE difficulty IS NOT NULL 
      GROUP BY difficulty 
      ORDER BY 
        CASE difficulty 
          WHEN 'Easy' THEN 1 
          WHEN 'Medium' THEN 2 
          WHEN 'Hard' THEN 3 
        END
    `).all() as Array<{ difficulty: string, count: number }>

    if (difficultyStats.length > 0) {
      console.log('\n🎯 By Difficulty:')
      difficultyStats.forEach((stat) => {
        const emoji = stat.difficulty === 'Easy'
          ? '🟢'
          : stat.difficulty === 'Medium' ? '🟡' : '🔴'
        console.log(`  ${emoji} ${stat.difficulty}: ${stat.count}`)
      })
    }

    // Sample problems
    console.log('\n🎲 Sample Problems:')
    const samples = this.db.prepare(`
      SELECT problem_statement, difficulty, topic 
      FROM functions_problems 
      WHERE problem_statement IS NOT NULL 
      ORDER BY RANDOM() 
      LIMIT 3
    `).all() as Array<{ problem_statement: string, difficulty: string, topic: string }>

    samples.forEach((sample, index) => {
      const difficultyEmoji = sample.difficulty === 'Easy'
        ? '🟢'
        : sample.difficulty === 'Medium' ? '🟡' : '🔴'
      console.log(`  ${index + 1}. [${sample.topic}] ${difficultyEmoji} ${sample.problem_statement.substring(0, 60)}...`)
    })
  }

  close(): void {
    console.log('🔒 Closing database connection...')
    this.db.close()
  }
}

async function main(): Promise<void> {
  console.log('🏁 Starting migration script...')

  const notionToken = process.env.NOTION_TOKEN

  if (!notionToken) {
    console.error('❌ NOTION_TOKEN environment variable is not set!')
    console.error('💡 Make sure you have a .env file with: NOTION_TOKEN=secret_your_token_here')
    process.exit(1)
  }

  console.log('✅ Found Notion token')

  const migrator = new FunctionsDatabaseMigrator(notionToken)

  try {
    await migrator.migrate()
  } catch (error) {
    console.error('💥 Migration failed:', error)
    process.exit(1)
  } finally {
    migrator.close()
  }
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}

export { FunctionsDatabaseMigrator }
