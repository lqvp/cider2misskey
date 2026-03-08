<script setup lang="ts">
defineProps<{
  label: string;
  type?: "text" | "password";
  placeholder?: string;
}>();

const model = defineModel<string>();
</script>

<template>
  <label class="np-field">
    {{ label }}
    <input
      class="c-input"
      v-model="model"
      :type="type || 'text'"
      :placeholder="placeholder"
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
