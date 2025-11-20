<template>
  <div class="max-w-md mx-auto p-6">
    <UForm
      class="space-y-4"
      @submit="handleSubmit"
    >
      <UTextarea
        v-model="inputValue"
        placeholder="Enter functions (one per line)&#10;Example:&#10;y = x^2&#10;y = 2x + 1&#10;y = sin(x)"
        size="lg"
        :rows="4"
      />
      <UButton
        type="submit"
        color="primary"
        size="lg"
        block
        :loading="isSubmitting"
      >
        Submit Functions
      </UButton>
    </UForm>
    <div v-if="submittedFunctions.length > 0">
      <desmos-comp :functions="submittedFunctions" />
    </div>
  </div>
</template>

<script setup>
const inputValue = ref('')
const submittedFunctions = ref([])
const isSubmitting = ref(false)

const parseInputToFunctions = (input) => {
  // Split only by newlines and clean up
  return input
    .split('\n')
    .map(func => func.trim())
    .filter(func => func.length > 0)
}

const handleSubmit = async () => {
  if (!inputValue.value.trim()) return

  isSubmitting.value = true
  try {
    // Parse input into array of functions
    const functionsArray = parseInputToFunctions(inputValue.value)
    submittedFunctions.value = functionsArray

    console.log('Submitted functions:', functionsArray)

    // Clear input after successful submission
    inputValue.value = ''
  } catch (error) {
    console.error('Submission error:', error)
  } finally {
    isSubmitting.value = false
  }
}
</script>
