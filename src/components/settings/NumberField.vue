<script setup lang="ts">
defineProps<{
  label: string;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
}>();

const model = defineModel<number>();

function onInput(e: Event) {
  const target = e.target as HTMLInputElement;
  model.value = target.value === "" ? 0 : Number(target.value);
}
</script>

<template>
  <label class="np-field">
    {{ label }}
    <input
      class="c-input"
      type="number"
      :value="model"
      @input="onInput"
      :placeholder="placeholder"
      :min="min"
      :max="max"
      :step="step"
    />
  </label>
</template>

<style scoped lang="postcss">
.np-field {
  display: grid;
  gap: 0.5rem;
  font-weight: 600;
  color: var(--color-text-secondary, #d4d4d8);
}
</style>
