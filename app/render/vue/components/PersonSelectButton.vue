<template>
  <div
    class="person-select-field"
    :class="{ disabled, 'has-value': hasValue }"
    role="button"
    :aria-disabled="disabled"
    @click="handleClick"
  >
    <span class="person-select-text">
      {{ text }}
    </span>
    <span class="person-select-arrow">▼</span>
  </div>
</template>

<script setup>
const props = defineProps({
  text: {
    type: String,
    default: '-- Select Person --'
  },
  disabled: {
    type: Boolean,
    default: false
  },
  hasValue: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['click']);

const handleClick = () => {
  if (!props.disabled) {
    emit('click');
  }
};
</script>

<style scoped>
.person-select-field {
  min-width: 0;
  max-width: 100%;
  padding: 0.375rem 0.5rem;
  font-size: 14px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  transition: all 0.2s;
}

.person-select-field:hover:not(.disabled) {
  border-color: #2196F3;
  background: #f8f9fa;
}

.person-select-field.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: #f5f5f5;
}

.person-select-field .person-select-text {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.person-select-field .person-select-arrow {
  flex-shrink: 0;
  opacity: 0.5;
  font-size: 0.8em;
}

.person-select-field.has-value {
  font-weight: 500;
  color: #333;
}
</style>
