<!-- eslint-disable @typescript-eslint/no-unused-vars -->
<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
    <UCard class="w-full max-w-md">
      <template #header>
        <div class="text-center">
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
            Create Account
          </h1>
          <p class="text-gray-600 dark:text-gray-400 mt-1">
            Join us today!
          </p>
        </div>
      </template>

      <form
        class="space-y-4"
        @submit.prevent="handleRegister"
      >
        <UFormGroup
          label="Username"
          required
        >
          <UInput
            v-model="form.username"
            placeholder="johndoe"
            icon="i-heroicons-user"
            required
          />
        </UFormGroup>

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

        <UFormGroup
          label="Confirm Password"
          required
        >
          <UInput
            v-model="form.confirmPassword"
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
          Create Account
        </UButton>
      </form>

      <template #footer>
        <div class="text-center">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Already have an account?
            <NuxtLink
              to="/login"
              class="text-primary-600 hover:text-primary-500 font-medium"
            >
              Sign in
            </NuxtLink>
          </p>
        </div>
      </template>
    </UCard>
  </div>
</template>

<script setup>
const form = ref({
  username: '',
  email: '',
  password: '',
  confirmPassword: ''
})

const loading = ref(false)
const toast = useToast()

async function handleRegister() {
  // Validate passwords match
  if (form.value.password !== form.value.confirmPassword) {
    toast.add({
      title: 'Error',
      description: 'Passwords do not match',
      color: 'red'
    })
    return
  }

  loading.value = true

  try {
    const response = await $fetch('/api/auth/register', {
      method: 'POST',
      body: {
        username: form.value.username,
        email: form.value.email,
        password: form.value.password
      }
    })

    if (response.success) {
      toast.add({
        title: 'Success!',
        description: 'Account created successfully!',
        color: 'green'
      })

      await navigateTo('/login')
    }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    toast.add({
      title: 'Registration Failed',
      description: 'Email or username already exists',
      color: 'red'
    })
  }

  loading.value = false
}

definePageMeta({
  layout: false
})
</script>
