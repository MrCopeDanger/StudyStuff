<script setup lang="ts">
// Define Daily.co interface
interface DailyCall {
  join: (options: { url: string }) => void
  leave: () => void
}

interface DailyWindow {
  Daily: {
    createFrame: () => DailyCall
  }
}

const meetsStore = useMeetsStore()
const router = useRouter()

if (!meetsStore.currentMeetingUrl) {
  await router.push('/video_test/meet_list')
}

onMounted(() => {
  if (import.meta.client && meetsStore.currentMeetingUrl) {
    const dailyWindow = window as unknown as DailyWindow
    if (dailyWindow.Daily) {
      const call = dailyWindow.Daily.createFrame()
      call.join({ url: meetsStore.currentMeetingUrl })
    }
  }
})

onUnmounted(() => {
  meetsStore.clearCurrentMeeting()
})
</script>

<template>
  <div>
    <div class="mb-4">
      <UButton
        variant="ghost"
        @click="$router.push('/video_test/meet_list')"
      >
        ← Back to Rooms
      </UButton>
    </div>

    <div
      id="daily-frame"
      class="w-full h-screen"
    />
  </div>
</template>
