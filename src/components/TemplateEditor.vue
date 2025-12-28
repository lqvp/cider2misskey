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
  <div class="flex flex-col gap-3">
    <label class="grid gap-2 text-[var(--color-text-secondary,#d4d4d8)] font-semibold">
      {{ props.label }}
      <textarea
        ref="textareaRef"
        class="c-textarea"
        :value="modelValue"
        rows="5"
        @input="(e) => updateValue((e.target as HTMLTextAreaElement).value)"
      />
    </label>

    <div
      class="rounded-xl border border-[var(--color-border,rgba(255,255,255,0.1))] bg-[var(--color-background-secondary,rgba(255,255,255,0.06))] p-3"
    >
      <div class="mb-1.5 text-sm font-semibold text-[var(--color-text-secondary,#d4d4d8)]">
        {{ props.previewLabel }}
      </div>
      <pre class="m-0 whitespace-pre-wrap break-words rounded-lg bg-black/15 p-2.5 font-mono">{{ preview }}</pre>
      <div class="mt-1.5 text-xs text-[var(--color-text-tertiary,#a1a1aa)]">
        改行はそのまま投稿されます。
      </div>
    </div>

    <details
      class="rounded-xl border border-[var(--color-border,rgba(255,255,255,0.1))] bg-[var(--color-background-secondary,rgba(255,255,255,0.06))] p-3"
      open
    >
      <summary class="cursor-pointer font-bold text-[var(--color-text-primary,#fff)]">
        Placeholders
      </summary>
      <div class="mt-2 grid gap-2">
        <input class="c-input" v-model="query" placeholder="Search…" />
        <div class="text-xs text-[var(--color-text-tertiary,#a1a1aa)]">
          クリックで挿入 / Shift+クリックでコピー
        </div>
      </div>

      <div class="mt-2 text-xs text-[var(--color-text-secondary,#d4d4d8)]" v-if="copiedKey">
        Copied: <code>{{ copiedKey }}</code>
      </div>

      <div class="mt-3 max-h-150 overflow-y-auto pr-1">
        <div v-for="[group, items] in groupedPlaceholders" :key="group" class="mt-3">
          <div class="mb-2 text-sm font-bold text-[var(--color-text-secondary,#d4d4d8)]">
            {{ group }}
          </div>
          <div class="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-2">
            <button
              v-for="p in items"
              :key="p.key"
              type="button"
              class="grid gap-1 rounded-lg border border-white/10 bg-white/5 p-2 text-left transition hover:border-white/20 hover:bg-white/10"
              @click="(e) => onPlaceholderClick(p.key, e as MouseEvent)"
              :title="p.description"
            >
              <code class="font-bold">{{ '{' + p.key + '}' }}</code>
              <span class="text-xs text-[var(--color-text-tertiary,#a1a1aa)]">
                {{ p.description }}
              </span>
            </button>
          </div>
        </div>
      </div>
    </details>
  </div>
</template>
