<script setup lang="ts">
import { useUserStore } from '~/stores/user'

const userStore = useUserStore()
await userStore.fetchUser()

// defines items in nav menu//

const items = computed(() => [
  {
    label: 'Dashboard',
    icon: 'i-lucide-layout-dashboard',
    to: '/dashboard'
  },
  {
    label: 'Resources',
    icon: 'i-lucide-book-open',
    to: '/resources'
  },
  {
    label: 'Practice',
    icon: 'i-lucide-clipboard-list',
    to: '/practice'
  },
  {
    label: 'Sessions',
    icon: 'i-lucide-users',
    to: '/sessions'
  },
  {
    label: userStore.user?.user.name ?? 'Waiting for user',
    // user is stored in user so userStore.user.user.name
    // ignoer the 'user' does not exist on type 'never' error
    avatar: {
      src: userStore.user?.user.avatar,
      alt: userStore.user?.user.name,
      size: 'sm'
    },
    to: '/user'
  }
])
</script>

<template>
  <div>
    <UHeader title="StudyStuffByDanger" />
    <div class="flex">
      <UNavigationMenu
        :items="items"
        orientation="vertical"
        class="max-w-36"
      />
      <slot />
    </div>
  </div>
</template>
