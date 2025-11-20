<script setup lang="ts">
import { useUserStore } from '~/stores/user'

// checks to see if a user is logged in, and creates a toast popup if no user is logged in
const userStore = useUserStore()
const toast = useToast()
try {
  await userStore.fetchUser()
} catch (err) {
  toast.add({ title: 'Failed to log in', description: 'Please Log in again', color: 'error' })
  navigateTo('/account_test/login')
  console.log(err)
}
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
