<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { getPlaceholders, renderTemplatePreview } from "../services/nowPlayingPoster";

const props = withDefaults(
  defineProps<{
    modelValue: string;
    sampleInfo?: any;
    label?: string;
    previewLabel?: string;
  }>(),
  {
    label: "Template",
    previewLabel: "Preview",
  }
);

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

const textareaRef = ref<HTMLTextAreaElement>();
const query = ref("");
const copiedKey = ref<string>("");

const placeholders = getPlaceholders();

const filteredPlaceholders = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return placeholders;
  return placeholders.filter(
    (p) =>
      p.key.toLowerCase().includes(q) ||
      p.group.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q)
  );
});

const groupedPlaceholders = computed(() => {
  const groups = new Map<string, typeof placeholders>();
  for (const p of filteredPlaceholders.value) {
    const arr = groups.get(p.group) ?? [];
    arr.push(p);
    groups.set(p.group, arr);
  }
  return Array.from(groups.entries());
});

const sampleFallback = computed(() => {
  return (
    props.sampleInfo ?? {
      name: "Sample Song",
      artistName: "Sample Artist",
      albumName: "Sample Album",
      durationInMillis: 210000,
      currentPlaybackTime: 42,
      remainingTime: 168,
      url: "https://music.apple.com/",
    }
  );
});

const preview = computed(() => {
  return renderTemplatePreview(props.modelValue ?? "", sampleFallback.value);
});

function updateValue(value: string) {
  emit("update:modelValue", value);
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    copiedKey.value = text;
    window.setTimeout(() => {
      if (copiedKey.value === text) copiedKey.value = "";
    }, 1200);
  } catch {
    // Best-effort fallback: select text in textarea
    updateValue(`${props.modelValue ?? ""}${text}`);
  }
}

function insertAtCursor(text: string) {
  const current = props.modelValue ?? "";
  const el = textareaRef.value;
  if (!el) {
    updateValue(current + text);
    return;
  }
  const start = el.selectionStart ?? current.length;
  const end = el.selectionEnd ?? current.length;
  updateValue(current.slice(0, start) + text + current.slice(end));
  nextTick(() => {
    el.focus();
    el.setSelectionRange(start + text.length, start + text.length);
  });
}

function onPlaceholderClick(key: string, e: MouseEvent) {
  const token = `{${key}}`;
  if (e.shiftKey) {
    copyToClipboard(token);
    return;
  }
  insertAtCursor(token);
}
</script>

<template>
  <div class="te-root">
    <label class="te-label">
      {{ props.label }}
      <textarea
        ref="textareaRef"
        class="c-textarea"
        :value="modelValue"
        rows="5"
        @input="(e) => updateValue((e.target as HTMLTextAreaElement).value)"
      />
    </label>

    <div class="te-preview-box">
      <div class="te-preview-label">
        {{ props.previewLabel }}
      </div>
      <pre class="te-preview-pre">{{ preview }}</pre>
      <div class="te-preview-hint">
        改行はそのまま投稿されます。
      </div>
    </div>

    <details class="te-details" open>
      <summary class="te-summary">Placeholders</summary>
      <div class="te-search-area">
        <input class="c-input" v-model="query" placeholder="Search…" />
        <div class="te-search-hint">
          クリックで挿入 / Shift+クリックでコピー
        </div>
      </div>

      <div class="te-copied-notice" v-if="copiedKey">
        Copied: <code>{{ copiedKey }}</code>
      </div>

      <div class="te-placeholders-container">
        <div v-for="[group, items] in groupedPlaceholders" :key="group" class="te-group">
          <div class="te-group-title">{{ group }}</div>
          <div class="te-placeholder-grid">
            <button
              v-for="p in items"
              :key="p.key"
              type="button"
              class="te-placeholder-btn"
              @click="(e) => onPlaceholderClick(p.key, e as MouseEvent)"
              :title="p.description"
            >
              <code class="te-placeholder-code">{{ '{' + p.key + '}' }}</code>
              <span class="te-placeholder-desc">{{ p.description }}</span>
            </button>
          </div>
        </div>
      </div>
    </details>
  </div>
</template>

<style scoped>
.te-root {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.te-label {
  display: grid;
  gap: 0.5rem;
  color: var(--color-text-secondary, #d4d4d8);
  font-weight: 600;
}

.te-preview-box {
  border-radius: 0.75rem;
  border: 1px solid var(--color-border, rgba(255, 255, 255, 0.1));
  background-color: var(--color-background-secondary, rgba(255, 255, 255, 0.06));
  padding: 0.75rem;
}

.te-preview-label {
  margin-bottom: 0.375rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-secondary, #d4d4d8);
}

.te-preview-pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  border-radius: 0.5rem;
  background-color: rgba(0, 0, 0, 0.15);
  padding: 0.625rem;
  font-family: ui-monospace, monospace;
}

.te-preview-hint {
  margin-top: 0.375rem;
  font-size: 0.75rem;
  color: var(--color-text-tertiary, #a1a1aa);
}

.te-details {
  border-radius: 0.75rem;
  border: 1px solid var(--color-border, rgba(255, 255, 255, 0.1));
  background-color: var(--color-background-secondary, rgba(255, 255, 255, 0.06));
  padding: 0.75rem;
}

.te-summary {
  cursor: pointer;
  font-weight: 700;
  color: var(--color-text-primary, #fff);
}

.te-search-area {
  margin-top: 0.5rem;
  display: grid;
  gap: 0.5rem;
}

.te-search-hint {
  font-size: 0.75rem;
  color: var(--color-text-tertiary, #a1a1aa);
}

.te-copied-notice {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: var(--color-text-secondary, #d4d4d8);
}

.te-placeholders-container {
  margin-top: 0.75rem;
  max-height: 600px;
  overflow-y: auto;
  padding-right: 0.25rem;
}

.te-group {
  margin-top: 0.75rem;
}

.te-group:first-child {
  margin-top: 0;
}

.te-group-title {
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--color-text-secondary, #d4d4d8);
}

.te-placeholder-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.5rem;
}

.te-placeholder-btn {
  display: grid;
  gap: 0.25rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background-color: rgba(255, 255, 255, 0.05);
  padding: 0.5rem;
  text-align: left;
  transition: all 0.2s ease;
}

.te-placeholder-btn:hover {
  border-color: rgba(255, 255, 255, 0.2);
  background-color: rgba(255, 255, 255, 0.1);
}

.te-placeholder-code {
  font-weight: 700;
}

.te-placeholder-desc {
  font-size: 0.75rem;
  color: var(--color-text-tertiary, #a1a1aa);
}
</style>
