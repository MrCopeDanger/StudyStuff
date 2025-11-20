<script setup lang="ts">
import { z } from 'zod'
import { CalendarDateTime, getLocalTimeZone, DateFormatter } from '@internationalized/date'
import type { FormSubmitEvent, SelectMenuItem } from '#ui/types'

const data = ref(null)
const selectedDate = ref()
const selectedHour = ref(12)
const selectedMinute = ref(0)
const eventLength = ref() // Default to 60 minutes
const eventName = ref('')
const eventDescription = ref('')

// Generate duration options in 15-minute increments
const durationOptions = ref<SelectMenuItem[]>([
  {
    label: '15',
    id: 15
  },
  {
    label: '30',
    id: 30
  },
  {
    label: '45',
    id: 45
  },
  {
    label: '60',
    id: 60
  },
  {
    label: '1:15',
    id: 75
  },
  {
    label: '1:30',
    id: 90
  },
  {
    label: '1:45',
    id: 105
  },
  {
    label: '2:00',
    id: 120
  }
])

// Date and time formatters
const dateFormatter = new DateFormatter('en-US', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric'
})

const timeFormatter = new DateFormatter('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true
})

const fullFormatter = new DateFormatter('en-US', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true
})

// Computed start datetime
const datetime = computed({
  get() {
    if (!selectedDate.value) return undefined

    if (selectedDate.value.hour === undefined) {
      return new CalendarDateTime(
        selectedDate.value.year,
        selectedDate.value.month,
        selectedDate.value.day,
        selectedHour.value,
        selectedMinute.value
      )
    }

    return selectedDate.value
  },
  set(value) {
    selectedDate.value = value
    if (value) {
      selectedHour.value = value.hour ?? 12
      selectedMinute.value = value.minute ?? 0
    }
  }
})

// Computed end datetime based on event length
const endDatetime = computed(() => {
  if (!datetime.value || !eventLength.value) return null

  return datetime.value.add({ minutes: eventLength.value })
})

// Formatted display strings
const formattedDisplay = computed(() => {
  if (!datetime.value || !endDatetime.value) return null

  const tz = getLocalTimeZone()
  const startDate = datetime.value.toDate(tz)
  const endDate = endDatetime.value.toDate(tz)

  // Check if event spans multiple days
  const sameDay = datetime.value.year === endDatetime.value.year
    && datetime.value.month === endDatetime.value.month
    && datetime.value.day === endDatetime.value.day

  return {
    date: dateFormatter.format(startDate),
    startTime: timeFormatter.format(startDate),
    endTime: timeFormatter.format(endDate),
    fullStart: fullFormatter.format(startDate),
    fullEnd: fullFormatter.format(endDate),
    sameDay,
    duration: formatDuration(eventLength.value)
  }
})

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (hours > 0 && mins > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ${mins} minute${mins > 1 ? 's' : ''}`
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''}`
  } else {
    return `${mins} minute${mins > 1 ? 's' : ''}`
  }
}

const schema = z.object({
  startDatetime: z.any().refine(val => val?.toDate, {
    message: 'Please select a start date and time'
  }).transform(dt => dt.toDate(getLocalTimeZone()).toISOString()),
  endDatetime: z.any().refine(val => val?.toDate, {
    message: 'End date is required'
  }).transform(dt => dt.toDate(getLocalTimeZone()).toISOString()),
  eventLength: z.number().min(15, 'Event length must be at least 15 minutes'),
  eventName: z.string().max(50, 'Name too long'),
  eventDescription: z.string()
})

type Schema = z.output<typeof schema>

// Update datetime when time changes
watch([selectedHour, selectedMinute], () => {
  if (selectedDate.value) {
    selectedDate.value = new CalendarDateTime(
      selectedDate.value.year,
      selectedDate.value.month,
      selectedDate.value.day,
      selectedHour.value,
      selectedMinute.value
    )
  }
})

async function onSubmit(event: FormSubmitEvent<Schema>) {
  const formData = new FormData()
  formData.append('start', event.data.startDatetime)
  formData.append('end', event.data.endDatetime)
  formData.append('name', event.data.eventName)
  formData.append('description', event.data.eventDescription)

  data.value = await $fetch('/api/create_meet', {
    method: 'POST',
    body: formData
  })

  for (const [key, value] of formData.entries()) {
    console.log(key, value)
  }
}
</script>

<template>
  <UForm
    :schema="schema"
    :state="{ startDatetime: datetime, endDatetime: endDatetime, eventLength, eventName, eventDescription }"
    @submit="onSubmit"
  >
    <UFormField
      label="Event Start Date & Time"
      name="startDatetime"
    >
      <div class="space-y-4">
        <UCalendar v-model="selectedDate" />
        <div class="flex justify-around">
          <div class="flex gap-2 items-center">
            <UInput
              v-model.number="selectedHour"
              type="number"
              min="0"
              max="23"
              placeholder="HH"
              class="w-20"
            />
            <span>:</span>
            <UInput
              v-model.number="selectedMinute"
              type="number"
              min="0"
              max="59"
              placeholder="MM"
              class="w-20"
            />
          </div>

          <USelect
            v-model="eventLength"
            :items="durationOptions"
            value-key="id"
            placeholder="Select duration"
          />
        </div>
      </div>
    </UFormField>

    <UFormField
      label="Name and description"
      name="nameAndDescription"
    >
      <div class="justify-around flex gap-4">
        <UInput
          v-model="eventName"
          :maxlength="50"
          aria-describedby="character-count"
          :ui="{ trailing: 'pointer-events-none' }"
          placeholder="Session Name"
        >
          <template #trailing>
            <div
              id="character-count"
              class="text-xs text-muted tabular-nums"
              aria-live="polite"
              role="status"
            >
              {{ eventName?.length }}/50
            </div>
          </template>
        </UInput>
        <UTextarea
          v-model="eventDescription"
          placeholder="Session Description"
        />
      </div>
    </UFormField>

    <!-- Event Display -->
    <div
      v-if="formattedDisplay && eventName"
      class="p-6 bg-muted rounded-lg"
    >
      <div class="text-lg font-semibold text mb-4">
        {{ eventName }}
      </div>

      <div class="text-sm font-semibold text-muted mb-4 wrap-anywhere">
        {{ eventDescription }}
      </div>

      <div class="space-y-3">
        <div v-if="formattedDisplay.sameDay">
          <div class="text-base font-medium text">
            {{ formattedDisplay.date }}
          </div>
          <div class="text-2xl font-bold text-highlighted mt-1">
            {{ formattedDisplay.startTime }} - {{ formattedDisplay.endTime }}
          </div>
          <div class="text-sm text mt-1">
            Duration: {{ formattedDisplay.duration }}
          </div>
        </div>

        <div
          v-else
          class="space-y-2"
        >
          <div>
            <div class="text-sm text-gray-600">
              Starts
            </div>
            <div class="text-lg font-semibold text-gray-900">
              {{ formattedDisplay.fullStart }}
            </div>
          </div>
          <div>
            <div class="text-sm text-gray-600">
              Ends
            </div>
            <div class="text-lg font-semibold text-gray-900">
              {{ formattedDisplay.fullEnd }}
            </div>
          </div>
          <div class="text-sm text-gray-600 mt-2">
            Duration: {{ formattedDisplay.duration }}
          </div>
        </div>
      </div>
    </div>

    <div
      v-else
      class="p-6 bg-muted rounded-lg"
    >
      <div class="text-sm text-muted text-center">
        Select a date and time to see event details
      </div>
    </div>

    <UButton
      type="submit"
    >
      Submit
    </UButton>
  </UForm>
</template>
