import { db } from '~~/src/db/auth/index'
import { meetsTable } from '~~/src/db/auth/schema'

export default defineEventHandler(async (event) => {
  const formData = await readFormData(event)
  if (!formData) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid data' })
  }

  const name = formData.get('name') as string
  const description = formData.get('description') as string
  const startTime = formData.get('start') as string
  const endTime = formData.get('end') as string

  console.log('from api: ', name, description, startTime, endTime)
  // logs in the terminal, not in browser console bc it's server side

  // Turns iso datetime into unix timestamp for daily.co
  const start = Math.floor(new Date(startTime).getTime() / 1000) // nbf
  const end = Math.floor(new Date(endTime).getTime() / 1000) // exp

  const options = {
    properties: {
      nbf: start,
      exp: end,
      eject_at_room_exp: true
    }
  }

  fetch('https://api.daily.co/v1/rooms/', {
    method: 'POST',
    body: JSON.stringify(options),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + process.env.DAILY_API_KEY
    }
  })
    .then(async (r) => {
      if (!r.ok) {
      // If the response is not OK, parse the error and throw it
        const error = await r.json()
        throw new Error(error.error || 'Unknown error')
      }
      return r.json()
    })
    .then(async (room) => {
      console.log('Room created:', room.url)
      await db.insert(meetsTable).values({
        name: name,
        description: description,
        startTime: startTime,
        endTime: endTime,
        link: room.url
      })
    })
    .catch((error) => {
      throw createError({
        statusCode: 400,
        statusMessage: error
      })
    })
})
