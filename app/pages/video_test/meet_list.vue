<script setup lang="ts">
const meetsStore = useMeetsStore()
const toast = useToast()
const router = useRouter()

await meetsStore.fetchMeets()

const joinMeeting = (room: {
  startTime: string
  link: string
}) => {
  const now = new Date()
  const startTime = new Date(room.startTime)

  if (now < startTime) {
    toast.add({
      title: 'Meeting Not Started',
      description: `This meeting starts at ${startTime.toLocaleTimeString()}`,
      icon: 'i-heroicons-clock',
      color: 'warning'
    })
    return
  }

  // Store the meeting URL and navigate
  meetsStore.setCurrentMeeting(room.link)
  router.push('/video_test/in_meet')
}
</script>

<template>
  <div>
    <h1>Open Rooms</h1>
    <div
      v-if="meetsStore.meets"
      class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
    >
      <UCard
        v-for="room in meetsStore.meets"
        :key="room.id"
        class="hover:shadow-lg transition-shadow"
      >
        <template #header>
          <h3 class="text-lg font-semibold">
            {{ room.name }}
          </h3>
        </template>

        <div class="space-y-2">
          <p
            v-if="room.description"
            class="text-gray-600"
          >
            {{ room.description }}
          </p>
          <div class="text-sm text-gray-500">
            <p>Start:  {{ new Date(room.startTime).toLocaleString() }} </p>
            <p>End:  {{ new Date(room.endTime).toLocaleString() }} </p>
          </div>
        </div>

        <template #footer>
          <UButton
            color="primary"
            class="w-full"
            @click="joinMeeting(room)"
          >
            Join Meeting
          </UButton>
        </template>
      </UCard>
    </div>
    <div v-else>
      Loading...
    </div>
  </div>
</template>
