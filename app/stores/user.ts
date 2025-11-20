import { defineStore } from 'pinia'

export const useUserStore = defineStore('user', {
  state: () => ({
    user: null
  }),
  actions: {
    async fetchUser() {
      try {
        this.user = await $fetch('/api/me')
        console.log('user fetched and stored')
        console.log(this.user)
      } catch (err) {
        this.user = null // Explicitly set to null on error
        // Optionally, handle specific error codes here
        console.log(err)
      }
    }
  }
})
