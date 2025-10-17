<!-- eslint-disable @typescript-eslint/no-unused-vars -->
<!-- eslint-disable @typescript-eslint/no-unused-vars -->
<!-- eslint-disable @typescript-eslint/no-unused-vars -->
<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
    <UCard class="w-full max-w-md">
      <template #header>
        <div class="text-center">
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
            Sign In
          </h1>
          <p class="text-gray-600 dark:text-gray-400 mt-1">
            Welcome back!
          </p>
        </div>
      </template>

      <form
        class="space-y-4"
        @submit.prevent="handleLogin"
      >
        <UFormGroup
          label="Email"
          required
        >
          <UInput
            v-model="form.email"
            type="email"
            placeholder="your@email.com"
            icon="i-heroicons-envelope"
            required
          />
        </UFormGroup>

        <UFormGroup
          label="Password"
          required
        >
          <UInput
            v-model="form.password"
            type="password"
            placeholder="••••••••"
            icon="i-heroicons-lock-closed"
            required
          />
        </UFormGroup>

        <UButton
          type="submit"
          block
          :loading="loading"
          size="lg"
        >
          Sign In
        </UButton>
      </form>

      <template #footer>
        <div class="text-center">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Don't have an account?
            <NuxtLink
              to="/register"
              class="text-primary-600 hover:text-primary-500 font-medium"
            >
              Sign up
            </NuxtLink>
          </p>
        </div>
      </template>
    </UCard>
  </div>
</template>

<script setup>
const form = ref({
  email: '',
  password: ''
})

const loading = ref(false)
const toast = useToast()

async function handleLogin() {
  loading.value = true

  try {
    const response = await $fetch('/api/auth/login', {
      method: 'POST',
      body: form.value
    })

    if (response.success) {
      toast.add({
        title: 'Success!',
        description: `Welcome back, ${response.user.username}!`,
        color: 'green'
      })

      await navigateTo('/dashboard')
    }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    toast.add({
      title: 'Login Failed',
      description: 'Invalid email or password',
      color: 'red'
    })
  }

  loading.value = false
}

definePageMeta({
  layout: false
})
</script>
