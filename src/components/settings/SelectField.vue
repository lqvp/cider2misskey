<script setup lang="ts">
defineProps<{
  label: string;
  options: { value: string; label: string }[];
}>();

const model = defineModel<string>();
</script>

<template>
  <label class="np-field">
    {{ label }}
    <select class="c-select" v-model="model">
      <option v-for="opt in options" :key="opt.value" :value="opt.value">
        {{ opt.label }}
      </option>
    </select>
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
