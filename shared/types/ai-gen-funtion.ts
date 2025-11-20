// See project README for run instructions: ../../README.md -> "Run the standalone AI script"
import { GoogleGenAI } from '@google/genai'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const key = process.env.GEMINI_API_KEY

// Safer debug: only indicate presence, don't reveal any part of the secret
console.log('GEMINI_API_KEY present:', !!key)

async function main() {
  if (!key) {
    console.error('Error: GEMINI_API_KEY is not loaded. Please check your .env file and its path.')
    // Fail fast for the standalone script
    process.exit(1)
  }

  const ai = new GoogleGenAI({ apiKey: key })

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: 'Explain how AI works in a few words'
  })
  console.log(response.text)
}

await main()
