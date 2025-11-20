<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
// import { db } from '~~/src'
// import { accountsTable } from '~~/src/db/schema'
// import { eq, or } from 'drizzle-orm'
const data = ref(null)

const schema = z.object({
  email: z.email('Invalid email'),
  password: z.string('Password is required').min(8, 'Must be at least 8 characters'),
  remember: z.boolean()
})
// MAKE SURE THE REQIREMNETS HERE ARE THE SAME AS IN create_user.post.ts LEST BE THE CONSEQINCES
type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  email: undefined,
  password: undefined,
  remember: false
})

const toast = useToast()
async function onSubmit(event: FormSubmitEvent<Schema>) {
  try { // Send data to create_user.post.ts
    data.value = await $fetch('/api/login', {
      method: 'POST',
      body: event.data
    })
    toast.add({ title: 'Success', description: 'Loged in Successfuly', color: 'success' })
  } catch (error) {
    console.error(error)
    toast.add({ title: 'Error', description: 'The username or email may be wrong', color: 'error' })
  }
  // console.log(event.data)
}
</script>

<template>
  <UForm
    :schema="schema"
    :state="state"
    class="space-y-4 outline"
    @submit="onSubmit"
  >
    <p>Login</p>
    <UFormField
      label="Email"
      name="email"
    >
      <UInput v-model="state.email" />
    </UFormField>

    <UFormField
      label="Password"
      name="password"
    >
      <UInput
        v-model="state.password"
        type="password"
      />
    </UFormField>

    <UFormField
      label="Remember Me"
      name="remember"
    >
      <UCheckbox
        v-model="state.remember"
        type="remember"
      />
    </UFormField>

    <UButton type="submit">
      Submit
    </UButton>
  </UForm>
</template>
