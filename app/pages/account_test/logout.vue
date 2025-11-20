<template>
  <UButton
    label="Logout"
    loading-auto
    @click="onClick"
  />
</template>

<script setup lang="ts">
// send request to destroy session
async function onClick() {
  await new Promise<void>(res => setTimeout(res, 1000))
  await $fetch('/api/logout', {
    method: 'POST'
  })
}
</script>
