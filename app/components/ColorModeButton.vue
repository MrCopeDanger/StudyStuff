<template>
  <UButton
    variant="ghost"
    size="sm"
    square
    @click="$colorMode.preference = $colorMode.value == 'dark' ? 'light' : 'dark'"
  >
    <UIcon :name="$colorMode.value == 'dark' ? 'i-heroicons-sun' : 'i-heroicons-moon'" />
  </UButton>
</template>
