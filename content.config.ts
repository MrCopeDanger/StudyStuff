import { defineContentConfig, defineCollection } from '@nuxt/content'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { z } from 'zod'

export default defineContentConfig({
  collections: {
    content: defineCollection({
      type: 'page',
      source: '**/*.md'
    })

  }
})
