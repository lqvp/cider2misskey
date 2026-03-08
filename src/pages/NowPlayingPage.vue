<script setup lang="ts">
import { computed, ref } from "vue";
import { useConfig } from "../config";
import { useNowPlayingPoster } from "../services/nowPlayingPoster";
import { useLogStore } from "../stores/logs";
import TemplateEditor from "../components/TemplateEditor.vue";
import SettingSection from "../components/settings/SettingSection.vue";
import FormField from "../components/settings/FormField.vue";
import SelectField from "../components/settings/SelectField.vue";
import CheckboxField from "../components/settings/CheckboxField.vue";
import NumberField from "../components/settings/NumberField.vue";

const cfg = useConfig();
const poster = useNowPlayingPoster();
const logs = useLogStore();

const lastTrack = computed(() => poster?.state.lastTrack);
const sampleInfo = computed(() => lastTrack.value);

function manualPost() {
  poster?.manualPost(true);
}

// Accordion state
const expandedSections = ref<Record<string, boolean>>({
  misskey: true,
  template: true,
  autopost: true,
  trigger: false,
  advanced: false,
});

function toggleSection(key: string) {
  expandedSections.value[key] = !expandedSections.value[key];
}

// Select options
const visibilityOptions = [
  { value: "public", label: "public" },
  { value: "home", label: "home" },
  { value: "followers", label: "followers" },
  { value: "direct", label: "direct" },
];

const repeatBehaviorOptions = [
  { value: "skip", label: "skip" },
  { value: "allow", label: "allow" },
];

const triggerModeOptions = [
  { value: "instant", label: "instant" },
  { value: "seconds", label: "seconds" },
  { value: "percent", label: "percent" },
  { value: "manual", label: "manual" },
];

const logLevelOptions = [
  { value: "debug", label: "debug" },
  { value: "info", label: "info" },
  { value: "error", label: "error" },
];
</script>

<template>
  <div class="plugin-base np-page">
    <h1 class="apple-heading">Misskey NowPlaying</h1>
    <p class="caption">自動投稿と手動投稿の管理ページ（開発用ログ込み）</p>

    <!-- Current Track Card -->
    <section class="np-card">
      <header class="np-card__header">
        <h3 class="np-card__title">現在のトラック</h3>
        <span class="np-pill" v-if="poster?.state?.isPosting">Posting…</span>
      </header>
      <div v-if="lastTrack">
        <div class="np-track-row">
          <div class="np-track-label">Title</div>
          <div>{{ lastTrack.name }}</div>
        </div>
        <div class="np-track-row">
          <div class="np-track-label">Artist</div>
          <div>{{ lastTrack.artistName }}</div>
        </div>
        <div class="np-track-row">
          <div class="np-track-label">Album</div>
          <div>{{ lastTrack.albumName }}</div>
        </div>
        <div class="np-track-row">
          <div class="np-track-label">Elapsed</div>
          <div>{{ Math.round(lastTrack.currentPlaybackTime ?? 0) }}s</div>
        </div>
        <div class="np-track-row">
          <div class="np-track-label">Duration</div>
          <div>{{ Math.round((lastTrack.durationInMillis ?? 0) / 1000) }}s</div>
        </div>
      </div>
      <div v-else>まだ再生情報を取得していません。</div>
      <div class="np-card__actions">
        <button class="c-btn" @click="manualPost">手動で今すぐ投稿</button>
      </div>
    </section>

    <!-- Template Card -->
    <section class="np-card">
      <header class="np-card__header">
        <h3 class="np-card__title">テンプレート</h3>
      </header>
      <TemplateEditor
        v-model="cfg.template"
        :sampleInfo="sampleInfo"
        label="Post text template"
      />
      <TemplateEditor
        v-if="cfg.cwEnabled"
        v-model="cfg.cwTemplate"
        :sampleInfo="sampleInfo"
        label="CW (visible) template"
      />
    </section>

    <!-- Settings Card with Accordion -->
    <section class="np-card">
      <header class="np-card__header">
        <h3 class="np-card__title">設定</h3>
      </header>

      <div class="np-accordion">
        <!-- Misskey Connection -->
        <div class="np-accordion-item">
          <button
            class="np-accordion-header"
            @click="toggleSection('misskey')"
            :aria-expanded="expandedSections.misskey"
          >
            <span class="np-accordion-title">Misskey 接続設定</span>
            <span
              class="np-accordion-icon"
              :class="{ 'np-accordion-icon--open': expandedSections.misskey }"
            >
              ▼
            </span>
          </button>
          <div v-show="expandedSections.misskey" class="np-accordion-body">
            <SettingSection title="インスタンス設定">
              <FormField
                v-model="cfg.instanceUrl"
                label="Misskey Instance URL"
                placeholder="https://misskey.io"
              />
              <FormField
                v-model="cfg.token"
                label="Token (write:notes)"
                type="password"
              />
              <SelectField
                v-model="cfg.visibility"
                label="Visibility"
                :options="visibilityOptions"
              />
              <CheckboxField v-model="cfg.localOnly" label="localOnly" />
              <CheckboxField
                v-model="cfg.cwEnabled"
                label="Use CW (content warning)"
              />
            </SettingSection>
          </div>
        </div>

        <!-- Autopost Settings -->
        <div class="np-accordion-item">
          <button
            class="np-accordion-header"
            @click="toggleSection('autopost')"
            :aria-expanded="expandedSections.autopost"
          >
            <span class="np-accordion-title">自動投稿設定</span>
            <span
              class="np-accordion-icon"
              :class="{ 'np-accordion-icon--open': expandedSections.autopost }"
            >
              ▼
            </span>
          </button>
          <div v-show="expandedSections.autopost" class="np-accordion-body">
            <SettingSection title="基本設定">
              <CheckboxField
                v-model="cfg.autopost"
                label="Autopost enabled"
              />
              <CheckboxField
                v-model="cfg.enableManualMenu"
                label="Add manual post menu entry"
              />
              <NumberField
                v-model="cfg.dedupeCooldownSec"
                label="Dedupe cooldown (sec)"
                :min="0"
              />
              <SelectField
                v-model="cfg.repeatBehavior"
                label="Repeat behavior"
                :options="repeatBehaviorOptions"
              />
            </SettingSection>

            <SettingSection
              title="リトライ設定"
              description="投稿失敗時の再試行設定"
            >
              <NumberField
                v-model="cfg.retries"
                label="Retries"
                :min="0"
              />
              <NumberField
                v-model="cfg.retryBackoffSec"
                label="Retry backoff (sec)"
                :min="0"
              />
            </SettingSection>
          </div>
        </div>

        <!-- Trigger Settings -->
        <div class="np-accordion-item">
          <button
            class="np-accordion-header"
            @click="toggleSection('trigger')"
            :aria-expanded="expandedSections.trigger"
          >
            <span class="np-accordion-title">トリガー設定</span>
            <span
              class="np-accordion-icon"
              :class="{ 'np-accordion-icon--open': expandedSections.trigger }"
            >
              ▼
            </span>
          </button>
          <div v-show="expandedSections.trigger" class="np-accordion-body">
            <SettingSection
              title="トリガーモード"
              description="自動投稿のタイミングを制御"
            >
              <SelectField
                v-model="cfg.triggerMode"
                label="Trigger mode"
                :options="triggerModeOptions"
              />
              <NumberField
                v-if="cfg.triggerMode === 'seconds'"
                v-model="cfg.triggerSeconds"
                label="Threshold seconds"
                :min="0"
                :step="1"
              />
              <NumberField
                v-if="cfg.triggerMode === 'percent'"
                v-model="cfg.triggerPercent"
                label="Threshold percent"
                :min="0"
                :max="100"
                :step="1"
              />
              <NumberField
                v-model="cfg.pollIntervalMs"
                label="Poll interval (ms)"
                :min="1000"
                :step="100"
              />
            </SettingSection>
          </div>
        </div>

        <!-- Advanced Settings -->
        <div class="np-accordion-item">
          <button
            class="np-accordion-header"
            @click="toggleSection('advanced')"
            :aria-expanded="expandedSections.advanced"
          >
            <span class="np-accordion-title">詳細設定</span>
            <span
              class="np-accordion-icon"
              :class="{ 'np-accordion-icon--open': expandedSections.advanced }"
            >
              ▼
            </span>
          </button>
          <div v-show="expandedSections.advanced" class="np-accordion-body">
            <SettingSection
              title="RPC設定"
              description="Cider RPCフォールバック設定"
            >
              <CheckboxField
                v-model="cfg.useRPC"
                label="Use RPC fallback (requires Cider RPC enabled)"
              />
              <FormField
                v-model="cfg.rpcBaseUrl"
                label="RPC Base URL"
                placeholder="http://localhost:10767"
              />
              <FormField
                v-if="cfg.useRPC"
                v-model="cfg.rpcAuthToken"
                label="RPC Auth Token (任意)"
              />
            </SettingSection>

            <SettingSection title="ログ設定">
              <SelectField
                v-model="cfg.logLevel"
                label="Log level"
                :options="logLevelOptions"
              />
            </SettingSection>
          </div>
        </div>
      </div>
    </section>

    <!-- Logs Card -->
    <section class="np-card">
      <header class="np-card__header">
        <h3 class="np-card__title">ログ (最新50件)</h3>
      </header>
      <div class="np-log-list">
        <div
          v-for="entry in logs.logs.slice(0, 50)"
          :key="entry.id"
          class="np-log-item"
        >
          <span class="np-log-time">{{
            new Date(entry.at).toLocaleTimeString()
          }}</span>
          <span :class="['np-log-level', `np-log-level--${entry.level}`]">
            {{ entry.level }}
          </span>
          <span class="np-log-message">{{ entry.message }}</span>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped lang="postcss">
@reference "../assets/tailwind.css";

.np-page {
  @apply p-6;
}

.np-card {
  @apply mt-6 rounded-xl border border-[var(--color-border,rgba(255,255,255,0.08))] bg-[var(--color-background-secondary,rgba(255,255,255,0.05))] p-6 transition;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.np-card:hover {
  @apply -translate-y-0.5;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.np-card__header {
  @apply mb-5 flex items-center gap-3 border-b border-[var(--color-border,rgba(255,255,255,0.08))] pb-3;
}

.np-card__title {
  @apply m-0 text-[1.25rem] font-semibold text-[var(--color-text-primary,inherit)];
}

.np-pill {
  @apply rounded-full bg-[var(--color-primary,#3b82f6)] px-2.5 py-1 text-xs font-medium tracking-wide text-white;
}

.np-track-row {
  @apply grid gap-4 border-b border-[var(--color-border,rgba(255,255,255,0.03))] py-2;
  grid-template-columns: 140px 1fr;
}

.np-track-label {
  @apply text-[13px] font-medium text-[var(--color-text-secondary,#999)];
}

.np-card__actions {
  @apply mt-4;
}

/* Accordion styles */
.np-accordion {
  @apply space-y-2;
}

.np-accordion-item {
  @apply rounded-lg border border-[var(--color-border,rgba(255,255,255,0.08))] bg-[var(--color-background-primary,rgba(0,0,0,0.2))] overflow-hidden;
}

.np-accordion-header {
  @apply w-full flex items-center justify-between px-4 py-3 text-left transition hover:bg-white/5;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--color-text-primary, inherit);
}

.np-accordion-title {
  @apply font-semibold text-sm;
}

.np-accordion-icon {
  @apply text-xs text-[var(--color-text-tertiary,#a1a1aa)] transition-transform duration-200;
}

.np-accordion-icon--open {
  @apply rotate-180;
}

.np-accordion-body {
  @apply px-4 pb-4;
}

.np-log-list {
  @apply max-h-72 overflow-y-auto rounded-lg border border-[var(--color-border,rgba(255,255,255,0.05))] bg-[var(--color-background-primary,rgba(0,0,0,0.3))] p-3 font-mono text-xs;
}

.np-log-item {
  @apply grid gap-3 rounded px-2 py-1 hover:bg-white/5;
  grid-template-columns: 85px 60px 1fr;
}

.np-log-time {
  @apply text-[11px] text-[var(--color-text-secondary,#999)];
}

.np-log-level {
  @apply rounded px-1 py-0.5 text-center text-[11px] font-bold uppercase;
}

.np-log-level--debug {
  @apply bg-cyan-400/10 text-cyan-300;
}

.np-log-level--info {
  @apply bg-lime-400/10 text-lime-300;
}

.np-log-level--error {
  @apply bg-red-400/10 text-red-300;
}

.np-log-message {
  @apply text-[var(--color-text-primary,inherit)];
}
</style>
