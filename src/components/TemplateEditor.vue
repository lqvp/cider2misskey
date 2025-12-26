<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { getPlaceholders, renderTemplatePreview } from "../services/nowPlayingPoster";

const props = defineProps<{
  modelValue: string;
  sampleInfo?: any;
}>();

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
  <div class="template-editor">
    <label class="input-label">
      Template
      <textarea
        ref="textareaRef"
        class="settings-textarea"
        :value="modelValue"
        rows="5"
        @input="(e) => updateValue((e.target as HTMLTextAreaElement).value)"
      />
    </label>

    <div class="template-preview">
      <div class="template-preview-label">Preview</div>
      <pre class="template-preview-body">{{ preview }}</pre>
      <div class="template-preview-hint">改行はそのまま投稿されます。</div>
    </div>

    <details class="placeholder-panel" open>
      <summary>Placeholders</summary>
      <div class="placeholder-controls">
        <input class="settings-input" v-model="query" placeholder="Search…" />
        <div class="placeholder-hint">
          クリックで挿入 / Shift+クリックでコピー
        </div>
      </div>

      <div class="placeholder-copied" v-if="copiedKey">
        Copied: <code>{{ copiedKey }}</code>
      </div>

      <div v-for="[group, items] in groupedPlaceholders" :key="group" class="placeholder-group">
        <div class="placeholder-group-title">{{ group }}</div>
        <div class="placeholder-list">
          <button
            v-for="p in items"
            :key="p.key"
            type="button"
            class="placeholder-item"
            @click="(e) => onPlaceholderClick(p.key, e as MouseEvent)"
            :title="p.description"
          >
            <code class="placeholder-key">{{ '{' + p.key + '}' }}</code>
            <span class="placeholder-desc">{{ p.description }}</span>
          </button>
        </div>
      </div>
    </details>
  </div>
</template>

<style scoped>
.template-editor {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.input-label {
  display: grid;
  gap: 8px;
  color: var(--color-text-secondary, #d4d4d8);
  font-weight: 600;
}

.settings-textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--color-border, rgba(255, 255, 255, 0.14));
  border-radius: 10px;
  background: var(--color-background-primary, rgba(0, 0, 0, 0.2));
  color: var(--color-text-primary, #fff);
  transition: all 0.2s ease;
  resize: vertical;
  font-family: "Source Code Pro", ui-monospace, SFMono-Regular, Menlo, Monaco,
    Consolas, "Liberation Mono", "Courier New", monospace;
  line-height: 1.4;
}

.settings-textarea:focus {
  outline: none;
  border-color: var(--color-primary, #3b82f6);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.25);
}

.template-preview {
  background: var(--color-background-secondary, rgba(255, 255, 255, 0.06));
  border: 1px solid var(--color-border, rgba(255, 255, 255, 0.1));
  border-radius: 12px;
  padding: 12px;
}

.template-preview-label {
  color: var(--color-text-secondary, #d4d4d8);
  font-weight: 600;
  margin-bottom: 6px;
}

.template-preview-body {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: "Source Code Pro", ui-monospace, SFMono-Regular, Menlo, Monaco,
    Consolas, "Liberation Mono", "Courier New", monospace;
  background: rgba(0, 0, 0, 0.15);
  border-radius: 10px;
  padding: 10px;
}

.template-preview-hint {
  margin-top: 6px;
  color: var(--color-text-tertiary, #a1a1aa);
  font-size: 12px;
}

.placeholder-panel {
  background: var(--color-background-secondary, rgba(255, 255, 255, 0.06));
  border: 1px solid var(--color-border, rgba(255, 255, 255, 0.1));
  border-radius: 12px;
  padding: 12px;
}

.placeholder-panel summary {
  cursor: pointer;
  font-weight: 700;
  color: var(--color-text-primary, #fff);
}

.placeholder-controls {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  margin-top: 10px;
}

.settings-input {
  width: 100%;
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--color-border, rgba(255, 255, 255, 0.14));
  border-radius: 10px;
  background: var(--color-background-primary, rgba(0, 0, 0, 0.2));
  color: var(--color-text-primary, #fff);
}

.settings-input:focus {
  outline: none;
  border-color: var(--color-primary, #3b82f6);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.25);
}

.placeholder-hint {
  color: var(--color-text-tertiary, #a1a1aa);
  font-size: 12px;
}

.placeholder-copied {
  margin-top: 8px;
  color: var(--color-text-secondary, #d4d4d8);
  font-size: 12px;
}

.placeholder-group {
  margin-top: 12px;
}

.placeholder-group-title {
  font-weight: 700;
  color: var(--color-text-secondary, #d4d4d8);
  margin-bottom: 8px;
}

.placeholder-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 8px;
}

.placeholder-item {
  display: grid;
  gap: 4px;
  text-align: left;
  padding: 10px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.06);
  cursor: pointer;
}

.placeholder-item:hover {
  border-color: rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.08);
}

.placeholder-key {
  font-weight: 700;
}

.placeholder-desc {
  color: var(--color-text-tertiary, #a1a1aa);
  font-size: 12px;
}
</style>
