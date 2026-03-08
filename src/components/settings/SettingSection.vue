<script setup lang="ts">
defineProps<{
  title: string;
  description?: string;
}>();
</script>

<template>
  <section class="np-settings-section">
    <div class="np-settings-header">
      <h4 class="np-settings-title">{{ title }}</h4>
      <p v-if="description" class="np-settings-desc">{{ description }}</p>
    </div>
    <div class="np-settings-content">
      <slot />
    </div>
  </section>
</template>

<style scoped lang="postcss">
.np-settings-section {
  border-top: 1px dashed var(--color-border, rgba(255, 255, 255, 0.08));
  padding-top: 1rem;
}
.np-settings-section:first-child {
  border-top: none;
  padding-top: 0;
}
.np-settings-header {
  margin-bottom: 0.75rem;
}
.np-settings-title {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 700;
  letter-spacing: 0.025em;
  color: var(--color-text-primary, inherit);
}
.np-settings-desc {
  margin: 0.25rem 0 0;
  font-size: 0.75rem;
  color: var(--color-text-tertiary, #a1a1aa);
}
.np-settings-content {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  align-items: end;
}
</style>
