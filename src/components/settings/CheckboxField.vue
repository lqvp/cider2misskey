<script setup lang="ts">
defineProps<{
  label: string;
}>();

const model = defineModel<boolean>();
</script>

<template>
  <label class="checkbox-label">
    <input class="c-checkbox" type="checkbox" v-model="model" />
    {{ label }}
  </label>
</template>
