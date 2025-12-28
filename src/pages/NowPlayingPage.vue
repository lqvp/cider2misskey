<script setup lang="ts">
import { computed } from "vue";
import { useConfig } from "../config";
import { useNowPlayingPoster } from "../services/nowPlayingPoster";
import { useLogStore } from "../stores/logs";
import TemplateEditor from "../components/TemplateEditor.vue";

const cfg = useConfig();
const poster = useNowPlayingPoster();
const logs = useLogStore();

const lastTrack = computed(() => poster?.state.lastTrack);
const sampleInfo = computed(() => lastTrack.value);

function manualPost() {
  poster?.manualPost(true);
}
</script>

<template>
  <div class="plugin-base np-page">
    <h1 class="apple-heading">Misskey NowPlaying</h1>
    <p class="caption">自動投稿と手動投稿の管理ページ（開発用ログ込み）</p>

    <section class="np-card">
      <header class="np-card__header">
        <h3 class="np-card__title">現在のトラック</h3>
        <span
          class="np-pill"
          v-if="poster?.state?.isPosting"
        >
          Posting…
        </span>
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
        <button
          class="c-btn"
          @click="manualPost"
        >
          手動で今すぐ投稿
        </button>
      </div>
    </section>

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

    <section class="np-card">
      <header class="np-card__header">
        <h3 class="np-card__title">設定</h3>
      </header>

      <div class="np-settings">
        <div class="np-settings-section">
          <h4 class="np-settings-title">Misskey</h4>
          <div class="np-settings-grid">
            <label class="np-field">
              Misskey Instance URL
              <input
                class="c-input"
                v-model="cfg.instanceUrl"
                placeholder="https://misskey.io"
              />
            </label>
            <label class="np-field">
              Token (write:notes)
              <input
                class="c-input"
                v-model="cfg.token"
                type="password"
              />
            </label>
            <label class="np-field">
              Visibility
              <select
                class="c-select"
                v-model="cfg.visibility"
              >
                <option value="public">public</option>
                <option value="home">home</option>
                <option value="followers">followers</option>
                <option value="direct">direct</option>
              </select>
            </label>
            <label class="checkbox-label">
              <input
                class="c-checkbox"
                type="checkbox"
                v-model="cfg.localOnly"
              />
              localOnly
            </label>
            <label class="checkbox-label">
              <input
                class="c-checkbox"
                type="checkbox"
                v-model="cfg.cwEnabled"
              />
              Use CW (content warning)
            </label>
          </div>
        </div>

        <div class="np-settings-section">
          <h4 class="np-settings-title">投稿</h4>
          <div class="np-settings-grid">
            <label class="checkbox-label">
              <input
                class="c-checkbox"
                type="checkbox"
                v-model="cfg.autopost"
              />
              Autopost enabled
            </label>
            <label class="checkbox-label">
              <input
                class="c-checkbox"
                type="checkbox"
                v-model="cfg.enableManualMenu"
              />
              Add manual post menu entry
            </label>
            <label class="np-field">
              Dedupe cooldown (sec)
              <input
                class="c-input"
                type="number"
                v-model.number="cfg.dedupeCooldownSec"
              />
            </label>
            <label class="np-field">
              Repeat behavior
              <select
                class="c-select"
                v-model="cfg.repeatBehavior"
              >
                <option value="skip">skip</option>
                <option value="allow">allow</option>
              </select>
            </label>
            <label class="np-field">
              Retries
              <input
                class="c-input"
                type="number"
                v-model.number="cfg.retries"
              />
            </label>
            <label class="np-field">
              Retry backoff (sec)
              <input
                class="c-input"
                type="number"
                v-model.number="cfg.retryBackoffSec"
              />
            </label>
          </div>
        </div>

        <div class="np-settings-section">
          <h4 class="np-settings-title">トリガー</h4>
          <div class="np-settings-grid">
            <label class="np-field">
              Trigger mode
              <select
                class="c-select"
                v-model="cfg.triggerMode"
              >
                <option value="instant">instant</option>
                <option value="seconds">seconds</option>
                <option value="percent">percent</option>
                <option value="manual">manual</option>
              </select>
            </label>
            <label
              class="np-field"
              v-if="cfg.triggerMode === 'seconds'"
            >
              Threshold seconds
              <input
                class="c-input"
                type="number"
                min="0"
                step="1"
                v-model.number="cfg.triggerSeconds"
              />
            </label>
            <label
              class="np-field"
              v-if="cfg.triggerMode === 'percent'"
            >
              Threshold percent
              <input
                class="c-input"
                type="number"
                min="0"
                max="100"
                step="1"
                v-model.number="cfg.triggerPercent"
              />
            </label>
            <label class="np-field">
              Poll interval (ms)
              <input
                class="c-input"
                type="number"
                v-model.number="cfg.pollIntervalMs"
              />
            </label>
          </div>
        </div>

        <div class="np-settings-section">
          <h4 class="np-settings-title">RPC</h4>
          <div class="np-settings-grid">
            <label class="checkbox-label">
              <input
                class="c-checkbox"
                type="checkbox"
                v-model="cfg.useRPC"
              />
              Use RPC fallback (requires Cider RPC enabled)
            </label>
            <label class="np-field">
              RPC Base URL
              <input
                class="c-input"
                v-model="cfg.rpcBaseUrl"
                placeholder="http://localhost:10767"
              />
            </label>
            <label
              class="np-field"
              v-if="cfg.useRPC"
            >
              RPC Auth Token (任意)
              <input
                class="c-input"
                v-model="cfg.rpcAuthToken"
              />
            </label>
          </div>
        </div>

        <div class="np-settings-section">
          <h4 class="np-settings-title">ログ</h4>
          <div class="np-settings-grid">
            <label class="np-field">
              Log level
              <select
                class="c-select"
                v-model="cfg.logLevel"
              >
                <option value="debug">debug</option>
                <option value="info">info</option>
                <option value="error">error</option>
              </select>
            </label>
          </div>
        </div>
      </div>
    </section>

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
          <span
            :class="['np-log-level', `np-log-level--${entry.level}`]"
          >
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

.np-settings {
  @apply space-y-5;
}

.np-settings-section {
  @apply border-t border-dashed border-[var(--color-border,rgba(255,255,255,0.08))] pt-4;
}

.np-settings-section:first-child {
  @apply border-0 pt-0;
}

.np-settings-title {
  @apply mb-3 text-sm font-bold tracking-wide text-[var(--color-text-primary,inherit)];
}

.np-settings-grid {
  @apply grid items-end gap-3.5;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}

.np-field {
  @apply grid gap-2 text-[var(--color-text-secondary,#d4d4d8)] font-semibold;
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
