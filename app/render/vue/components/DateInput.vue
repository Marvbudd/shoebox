<template>
  <div class="date-input">
    <div class="date-row" :class="{ 'date-row-small': size === 'small' }">
      <input 
        :value="year"
        @input="$emit('update:year', $event.target.value)"
        type="text"
        placeholder="YYYY"
        :class="size === 'small' ? 'date-year-small' : 'date-year'"
      />
      <select 
        :value="month"
        @change="$emit('update:month', $event.target.value)"
        :class="size === 'small' ? 'date-month-small' : 'date-month'"
      >
        <option value="">Month</option>
        <option v-for="m in validMonths" :key="m" :value="m">{{ m }}</option>
      </select>
      <input 
        :value="day"
        @input="$emit('update:day', $event.target.value)"
        type="text"
        placeholder="Day"
        :class="size === 'small' ? 'date-day-small' : 'date-day'"
      />
    </div>
    <small v-if="showHint" class="date-hint">Partial dates allowed (e.g., year only)</small>
  </div>
</template>

<script setup>
defineProps({
  year: {
    type: String,
    default: ''
  },
  month: {
    type: String,
    default: ''
  },
  day: {
    type: String,
    default: ''
  },
  showHint: {
    type: Boolean,
    default: true
  },
  size: {
    type: String,
    default: 'normal',
    validator: (value) => ['normal', 'small'].includes(value)
  }
});

defineEmits(['update:year', 'update:month', 'update:day']);

const validMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
</script>

<style scoped>
.date-input {
  width: 100%;
}

.date-row {
  display: grid;
  grid-template-columns: 120px 120px 80px;
  gap: 0.5rem;
}

.date-row-small {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.date-year,
.date-month,
.date-day {
  padding: 0.75rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 0.95rem;
}

.date-year:focus,
.date-month:focus,
.date-day:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.date-month {
  font-size: 0.95rem;
}

.date-year-small,
.date-month-small,
.date-day-small {
  width: auto !important;
  padding: 0.5rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 0.9rem;
}

.date-year-small {
  width: 80px !important;
}

.date-month-small {
  width: 70px !important;
}

.date-day-small {
  width: 50px !important;
}

.date-hint {
  display: block;
  margin-top: 0.25rem;
  color: #666;
  font-size: 0.85rem;
}
</style>
