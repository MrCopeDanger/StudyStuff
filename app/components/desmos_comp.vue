<template>
  <div>
    <div
      ref="calculatorElement"
      style="width: 800px; height: 500px; border: 2px solid #333;"
    >
      <div
        v-if="status !== 'loaded'"
        class="status-display"
      >
        <p>Status:  status </p>
        <div
          v-if="status === 'error'"
          class="text-red-500"
        >
          Check console for errors
        </div>
      </div>
    </div>
    <!-- Debug info -->
    <div class="mt-2 text-xs text-gray-500">
      <p>Functions:  functions?.length || 0  | Type:  typeof functions </p>
      <div v-if="functions?.length">
        <p
          v-for="(func, i) in functions"
          :key="i"
        >
          i : " func "
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  functions: {
    type: Array,
    default: () => []
  }
})

const calculatorElement = ref(null)
const status = ref('initializing')
const calculator = ref(null)

onMounted(() => {
  console.log('Component mounted, functions:', props.functions)
  initializeCalculator()
})

watch(() => props.functions, (newFunctions) => {
  console.log('Functions changed:', newFunctions)
  if (calculator.value && Array.isArray(newFunctions) && newFunctions.length > 0) {
    updateCalculatorExpressions()
  }
}, { deep: true, immediate: true })

async function initializeCalculator() {
  try {
    status.value = 'loading script'
    console.log('Starting calculator initialization')

    await nextTick()

    if (!calculatorElement.value) {
      throw new Error('Calculator element not found')
    }

    if (!window.Desmos) {
      console.log('Loading Desmos script...')
      await loadDesmosScript()
    }

    status.value = 'creating calculator'
    console.log('Creating Desmos calculator')

    calculator.value = window.Desmos.GraphingCalculator(calculatorElement.value, {
      expressions: true,
      settingsMenu: true,
      zoomButtons: true
    })

    console.log('Calculator created successfully')
    status.value = 'ready'

    if (Array.isArray(props.functions) && props.functions.length > 0) {
      updateCalculatorExpressions()
    }

    status.value = 'loaded'
  } catch (error) {
    console.error('Error initializing calculator:', error)
    status.value = 'error'
  }
}

function updateCalculatorExpressions() {
  if (!calculator.value) {
    console.log('No calculator available')
    return
  }

  if (!Array.isArray(props.functions) || props.functions.length === 0) {
    console.log('No valid functions to display')
    return
  }

  console.log('Updating calculator with functions:', props.functions)

  try {
    calculator.value.setBlank()

    props.functions.forEach((functionString, index) => {
      const cleanLatex = String(functionString)

      // Debug the exact string being sent to Desmos
      console.log(`Sending to Desmos [${index}]:`, functionString)
      console.log(`Characters:`, cleanLatex.split(''))
      console.log(`Has pipes:`, cleanLatex.includes('|'))
      console.log(`Has braces:`, cleanLatex.includes('{'))

      calculator.value.setExpression({
        id: `func-${index}`,
        latex: functionString,
        color: getColor(index)
      })

      // Check if Desmos accepted it
      console.log(`Expression ${index} added to calculator`)
    })

    console.log('Calculator updated successfully')
  } catch (error) {
    console.error('Error updating calculator expressions:', error)
  }
}

function getColor(index) {
  const colors = [
    '#2563eb', '#dc2626', '#16a34a', '#ca8a04',
    '#7c3aed', '#db2777', '#0891b2', '#ea580c'
  ]
  return colors[index % colors.length]
}

function loadDesmosScript() {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    // Use the correct API key URL
    script.src = 'https://www.desmos.com/api/v1.11/calculator.js?apiKey=ee5edfb0c7004b40ba8982c2fa63409e'

    script.onload = () => {
      console.log('Desmos script loaded successfully')
      console.log('Window.Desmos available:', !!window.Desmos)
      resolve()
    }

    script.onerror = (error) => {
      console.error('Failed to load Desmos script:', error)
      reject(new Error('Script loading failed'))
    }

    // Remove any existing Desmos script first
    const existing = document.querySelector('script[src*="desmos.com"]')
    if (existing) {
      existing.remove()
    }

    document.head.appendChild(script)
  })
}
</script>

<style scoped>
.status-display {
  padding: 20px;
  background: #f9fafb;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  font-family: monospace;
}
</style>
