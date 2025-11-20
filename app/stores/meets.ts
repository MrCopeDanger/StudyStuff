export interface Meet {
  id: string | number
  name: string
  description?: string
  startTime: string
  endTime: string
  link: string
}

export const useMeetsStore = defineStore('meets', {
  state: () => ({
    meets: null as Meet[] | null,
    currentMeetingUrl: null as string | null
  }),

  actions: {
    async fetchMeets() {
      try {
        this.meets = await $fetch<Meet[]>('/api/meets')
        console.log('meets fetched and stored')
      } catch (err) {
        this.meets = null
        console.log(err)
      }
    },

    setCurrentMeeting(url: string) {
      this.currentMeetingUrl = url
    },

    clearCurrentMeeting() {
      this.currentMeetingUrl = null
    }
  }
})
