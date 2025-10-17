<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <div class="max-w-4xl mx-auto py-8 px-4">
      <!-- Header -->
      <div class="flex justify-between items-center mb-8">
        <div>
          <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
            Dashboard
          </h1>
          <p class="text-gray-600 dark:text-gray-400 mt-1">
            Welcome to your account
          </p>
        </div>

        <div class="flex items-center gap-3">
          <ColorModeButton />
          <UButton
            variant="outline"
            color="red"
            @click="handleLogout"
          >
            <UIcon name="i-heroicons-arrow-right-on-rectangle" />
            Logout
          </UButton>
        </div>
      </div>

      <!-- Main Content -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <UCard>
          <template #header>
            <h3 class="text-lg font-semibold">
              Account Info
            </h3>
          </template>

          <div class="space-y-2">
            <p><strong>Username:</strong> johndoe</p>
            <p><strong>Email:</strong> john@example.com</p>
            <p><strong>Member since:</strong> Today</p>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <h3 class="text-lg font-semibold">
              Quick Actions
            </h3>
          </template>

          <div class="space-y-3">
            <UButton
              block
              variant="soft"
            >
              Update Profile
            </UButton>
            <UButton
              block
              variant="soft"
            >
              Change Password
            </UButton>
            <UButton
              block
              variant="soft"
            >
              Settings
            </UButton>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <h3 class="text-lg font-semibold">
              Statistics
            </h3>
          </template>

          <div class="space-y-2">
            <p><strong>Total Sessions:</strong> 1</p>
            <p><strong>Last Login:</strong> Now</p>
            <p>
              <strong>Status:</strong> <UBadge color="green">
                Active
              </UBadge>
            </p>
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>

<script setup>
const toast = useToast()

async function handleLogout() {
  try {
    await $fetch('/api/auth/logout', { method: 'POST' })

    toast.add({
      title: 'Logged out',
      description: 'See you soon!',
      color: 'green'
    })

    await navigateTo('/login')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    toast.add({
      title: 'Error',
      description: 'Logout failed',
      color: 'red'
    })
  }
}

definePageMeta({
  layout: false
})
</script>
