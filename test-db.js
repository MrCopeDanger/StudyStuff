import { db } from './lib/db.js'
import { pets } from './drizzle/schema.js'
import { nanoid } from 'nanoid'

// Add a test pet
await db.insert(pets).values({
  id: nanoid(),
  name: 'Fluffy'
})

console.log('Pet added!')