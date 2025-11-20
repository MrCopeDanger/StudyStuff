<template>
  <div class="debug-problemset">
    <UCard>
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold mb-4">
          Debug Problemset
        </h1>
        <div class="flex items-center gap-2">
          <label class="text-sm">Topic</label>
          <select
            v-model="selectedTopic"
            class="border rounded p-1"
          >
            <option
              v-for="t in topics"
              :key="t.name"
              :value="t.name"
            >
              {{ t.name }} ({{ t.count }})
            </option>
          </select>
          <UButton
            color="primary"
            @click="loadProblems"
          >
            Reload
          </UButton>
        </div>
      </div>

      <!-- Add new problem form -->
      <UCard class="mb-4">
        <h2 class="text-xl font-semibold mb-4">
          Add New Problem
        </h2>
        <form
          class="space-y-4"
          @submit.prevent="addProblem"
        >
          <UFormGroup label="Problem Title">
            <UInput
              v-model="newProblem.title"
              placeholder="Enter problem title"
              required
            />
          </UFormGroup>
          <UFormGroup label="Problem Description">
            <UTextarea
              v-model="newProblem.description"
              placeholder="Enter problem description"
              required
            />
          </UFormGroup>
          <UFormGroup label="Difficulty">
            <UInput
              v-model="newProblem.difficulty"
              type="number"
              :min="1"
              :max="10"
              required
            />
          </UFormGroup>
          <UButton
            type="submit"
            color="primary"
          >
            Add Problem
          </UButton>
        </form>
      </UCard>

      <!-- List of existing problems -->
      <UCard>
        <h2 class="text-xl font-semibold mb-4">
          Existing Problems
        </h2>
        <div class="space-y-4">
          <UCard
            v-for="problem in problems"
            :key="problem.id"
            class="problem-item"
          >
            <div v-if="editingProblem?.id === problem.id">
              <!-- Edit form -->
              <form
                class="space-y-4"
                @submit.prevent="updateProblem(problem.id)"
              >
                <UFormGroup label="Problem Title">
                  <UInput
                    v-model="editingProblem.title"
                    placeholder="Problem Title"
                  />
                </UFormGroup>
                <UFormGroup label="Problem Description">
                  <UTextarea
                    v-model="editingProblem.description"
                    placeholder="Problem Description"
                  />
                </UFormGroup>
                <UFormGroup label="Difficulty">
                  <UInput
                    v-model="editingProblem.difficulty"
                    type="number"
                    :min="1"
                    :max="10"
                  />
                </UFormGroup>
                <UFormGroup label="Type">
                  <select
                    v-model="editingProblem.type"
                    class="border rounded p-1"
                  >
                    <option value="arithmetic">
                      arithmetic
                    </option>
                    <option value="algebra">
                      algebra
                    </option>
                    <option value="word">
                      word
                    </option>
                    <option value="other">
                      other
                    </option>
                  </select>
                </UFormGroup>
                <UFormGroup label="Numeric answer">
                  <UInput
                    v-model.number="editingProblem.numeric_answer"
                    type="number"
                  />
                </UFormGroup>
                <UFormGroup label="Equation answer">
                  <UInput
                    v-model="editingProblem.equation_answer"
                    type="text"
                    placeholder="e.g. x = 2 or 2x+3=7"
                  />
                </UFormGroup>
                <UFormGroup label="Verified solution">
                  <UTextarea
                    v-model="editingProblem.verified_solution"
                    placeholder="Verified solution or explanation"
                  />
                </UFormGroup>
                <UFormGroup label="Verified">
                  <label class="inline-flex items-center gap-2">
                    <input
                      v-model="editingProblem.verified"
                      type="checkbox"
                    >
                    <span class="text-sm">Verified</span>
                  </label>
                </UFormGroup>
                <div class="flex gap-2">
                  <UButton
                    type="submit"
                    color="primary"
                  >
                    Save
                  </UButton>
                  <UButton
                    color="gray"
                    @click="cancelEdit"
                  >
                    Cancel
                  </UButton>
                </div>
              </form>
            </div>
            <div v-else>
              <h3 class="text-lg font-medium">
                {{ problem.title }}
              </h3>
              <p class="my-2">
                {{ problem.description }}
              </p>
              <p class="mb-2">
                Difficulty: {{ problem.difficulty }}
              </p>
              <p class="text-sm text-muted">
                Type: {{ problem.type ?? 'unknown' }} • Verified: <strong>{{ problem.verified ? 'yes' : 'no' }}</strong>
              </p>
              <p class="text-sm text-muted">
                Numeric answer: <strong>{{ problem.numeric_answer ?? '—' }}</strong>
              </p>
              <p class="text-sm text-muted">
                Equation answer: <strong>{{ problem.equation_answer ?? '—' }}</strong>
              </p>
              <p class="text-sm text-muted">
                Verified solution: {{ problem.verified_solution ?? '—' }}
              </p>
              <p class="text-xs text-muted">
                Created: {{ problem.created_at ?? 'unknown' }}
              </p>
              <div class="flex gap-2">
                <UButton
                  color="gray"
                  @click="startEdit(problem)"
                >
                  Edit
                </UButton>
                <UButton
                  color="primary"
                  @click="verifyProblem(problem.id)"
                >
                  Verify
                </UButton>
                <UButton
                  color="red"
                  @click="deleteProblem(problem.id)"
                >
                  Delete
                </UButton>
              </div>
            </div>
          </UCard>
        </div>
      </UCard>
    </UCard>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue'

// Local in-memory problems list for quick debugging.
// Replace these with API calls if you want server persistence.
const problems = ref([])
const topics = ref([])
const selectedTopic = ref('')

const newProblem = reactive({ title: '', description: '', difficulty: 1 })
const editingProblem = ref(null)

// Load topics from server and pick the first one
async function loadTopics() {
  try {
    const t = await $fetch('/api/topics')
    topics.value = Array.isArray(t) ? t : []
    if (topics.value.length > 0 && !selectedTopic.value) selectedTopic.value = topics.value[0].name
  } catch (e) {
    console.warn('Failed to load topics', e)
    topics.value = []
  }
}

// Load problems for the selected topic
async function loadProblems() {
  if (!selectedTopic.value) {
    await loadTopics()
    if (!selectedTopic.value) return
  }
  try {
    const rows = await $fetch(`/api/problems/${encodeURIComponent(selectedTopic.value)}`)

    if (Array.isArray(rows)) {
      problems.value = rows.map(r => ({
        id: r.id,
        title: r.prompt,
        description: r.model_solution ?? '',
        difficulty: r.difficulty ?? '',
        verified: Boolean(r.verified),
        numeric_answer: r.numeric_answer ?? null,
        equation_answer: r.equation_answer ?? null,
        verified_solution: r.verified_solution ?? null,
        created_at: r.created_at ?? null,
        type: r.type ?? null
      }))
    } else {
      problems.value = []
    }
  } catch (e) {
    console.warn('Failed to load problems', e)
    problems.value = []
  }
}

// Initialize on mount
onMounted(async () => {
  await loadTopics()
  await loadProblems()
})

watch(selectedTopic, async () => {
  await loadProblems()
})

async function addProblem() {
  if (!newProblem.title || !newProblem.description) return
  const id = Date.now() + Math.floor(Math.random() * 1000)
  // Try to persist to server if a topic is selected
  if (selectedTopic.value) {
    try {
      await $fetch(`/api/problems/${encodeURIComponent(selectedTopic.value)}`, {
        method: 'POST',
        body: {
          prompt: newProblem.title,
          model_solution: newProblem.description,
          difficulty: String(newProblem.difficulty || '1'),
          type: 'word',
          verified: 0
        }
      })
      // reload from server
      await loadProblems()
      newProblem.title = ''
      newProblem.description = ''
      newProblem.difficulty = 1
      return
    } catch (e) {
      console.warn('Failed to POST new problem, falling back to local:', e)
    }
  }

  // Fallback: local-only insert for debugging
  problems.value.unshift({
    id,
    title: newProblem.title,
    description: newProblem.description,
    difficulty: Number(newProblem.difficulty) || 1,
    verified: false
  })
  newProblem.title = ''
  newProblem.description = ''
  newProblem.difficulty = 1
}

function startEdit(problem) {
  editingProblem.value = {
    ...problem,
    numeric_answer: problem.numeric_answer ?? null,
    equation_answer: problem.equation_answer ?? null,
    verified: Boolean(problem.verified),
    verified_solution: problem.verified_solution ?? '',
    type: problem.type ?? 'word',
    difficulty: problem.difficulty ?? 1
  }
}

function cancelEdit() {
  editingProblem.value = null
}

async function updateProblem(id) {
  if (!editingProblem.value) return
  // Persist to server when topic is selected
  if (selectedTopic.value) {
    try {
      await $fetch(`/api/problems/${encodeURIComponent(selectedTopic.value)}`, {
        method: 'PUT',
        body: {
          id,
          prompt: editingProblem.value.title,
          model_solution: editingProblem.value.description,
          difficulty: String(editingProblem.value.difficulty ?? ''),
          type: editingProblem.value.type ?? null,
          verified: editingProblem.value.verified ? 1 : 0,
          verified_solution: editingProblem.value.verified_solution ?? null,
          numeric_answer: editingProblem.value.numeric_answer ?? null,
          equation_answer: editingProblem.value.equation_answer ?? null
        }
      })
      await loadProblems()
      editingProblem.value = null
      return
    } catch (e) {
      console.warn('Failed to persist update, falling back to local:', e)
    }
  }

  // Local-only update fallback
  const idx = problems.value.findIndex(p => p.id === id)
  if (idx === -1) return
  problems.value[idx] = {
    ...problems.value[idx],
    title: editingProblem.value.title,
    description: editingProblem.value.description,
    difficulty: Number(editingProblem.value.difficulty) || 1,
    type: editingProblem.value.type,
    numeric_answer: editingProblem.value.numeric_answer,
    equation_answer: editingProblem.value.equation_answer,
    verified_solution: editingProblem.value.verified_solution,
    verified: editingProblem.value.verified
  }
  editingProblem.value = null
}

async function verifyProblem(id) {
  if (selectedTopic.value) {
    try {
      await $fetch(`/api/problems/${encodeURIComponent(selectedTopic.value)}`, {
        method: 'PUT',
        body: { id, verified: 1 }
      })
      await loadProblems()
      return
    } catch (e) {
      console.warn('Failed to persist verify flag:', e)
    }
  }

  const idx = problems.value.findIndex(p => p.id === id)
  if (idx === -1) return
  problems.value[idx].verified = true
}

async function deleteProblem(id) {
  if (selectedTopic.value) {
    try {
      await $fetch(`/api/problems/${encodeURIComponent(selectedTopic.value)}`, {
        method: 'DELETE',
        body: { id }
      })
      await loadProblems()
      return
    } catch (e) {
      console.warn('Failed to delete on server, falling back to local:', e)
    }
  }

  problems.value = problems.value.filter(p => p.id !== id)
}
</script>

<style scoped>
.debug-problemset {
    padding: 20px;
    max-width: 800px;
    margin: 0 auto;
}
</style>
