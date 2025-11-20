// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxt/content',
    '@pinia/nuxt',
    '@nuxt/image',
    '@nuxt/scripts'
  ],
  devtools: {
    enabled: true
  },
  app: {
    head: {
      script: [
        {
          src: 'https://unpkg.com/@daily-co/daily-js'
        }
      ]
    }
  },
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    geminiApiKey: process.env.GEMINI_API_KEY, // server-side only
    public: {
      // anything you want to expose to client (do NOT put secret keys here)
    }
  },
  routeRules: {
    '/': { prerender: true }
  },
  compatibilityDate: '2025-01-15',
  nitro: {
    storage: {
      s3: {
        driver: 's3',
        accessKeyId: process.env.AWS_ACCESS_KEY,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        endpoint: 'https://study-stuff-avatar-bucket.s3.us-east-2.amazonaws.com',
        bucket: 'study-stuff-avatar-bucket',
        region: 'us-east-2'
      }
    }
  },
  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },
  image: {
    providers: {
      s3: {
        name: 's3',
        provider: 'ipx',
        options: {
          baseURL: 'https://study-stuff-avatar-bucket.s3.us-east-2.amazonaws.com'
        }
      }
    },
    domains: [
      'study-stuff-avatar-bucket.s3.us-east-2.amazonaws.com'
    ],
    alias: {
      s3: 'https://study-stuff-avatar-bucket.s3.us-east-2.amazonaws.com'
    }
  }
})
