<script setup lang="ts">
import { computed } from "vue";
import { useConfig } from "../config";
import { useNowPlayingPoster } from "../services/nowPlayingPoster";
import TemplateEditor from "./TemplateEditor.vue";

const cfg = useConfig();
const poster = useNowPlayingPoster();

const sampleInfo = computed(() => poster?.state.lastTrack);
</script>

<template>
  <div class="settings-container">
    <div class="header">
      <h2 class="settings-title">Misskey NowPlaying</h2>
      <p class="settings-subtitle">Ciderで再生中の曲を Misskey に投稿します。</p>
    </div>

    <section class="settings-group">
      <h3 class="group-title">Misskey</h3>
      <div class="grid">
        <label class="input-label">
          Instance URL
          <input
            class="settings-input"
            v-model="cfg.instanceUrl"
            placeholder="https://misskey.io"
            inputmode="url"
          />
        </label>

        <label class="input-label">
          Token (write:notes)
          <input class="settings-input" v-model="cfg.token" type="password" placeholder="Your token" />
        </label>

        <label class="input-label">
          Visibility
          <select class="settings-input" v-model="cfg.visibility">
            <option value="public">public</option>
            <option value="home">home</option>
            <option value="followers">followers</option>
            <option value="direct">direct</option>
          </select>
        </label>

        <label class="switch">
          <input type="checkbox" v-model="cfg.localOnly" />
          <span>localOnly</span>
        </label>
      </div>
    </section>

    <section class="settings-group">
      <h3 class="group-title">Posting</h3>
      <div class="grid">
        <label class="switch">
          <input type="checkbox" v-model="cfg.autopost" />
          <span>Autopost enabled</span>
        </label>

        <label class="switch">
          <input type="checkbox" v-model="cfg.cwEnabled" />
          <span>Content warning (CW)</span>
        </label>

        <label class="input-label">
          Trigger mode
          <select class="settings-input" v-model="cfg.triggerMode">
            <option value="instant">instant</option>
            <option value="seconds">seconds</option>
            <option value="percent">percent</option>
            <option value="manual">manual</option>
          </select>
        </label>

        <label v-if="cfg.triggerMode === 'seconds'" class="input-label">
          Trigger seconds
          <input class="settings-input" type="number" min="0" step="1" v-model.number="cfg.triggerSeconds" />
        </label>

        <label v-if="cfg.triggerMode === 'percent'" class="input-label">
          Trigger percent (%)
          <input class="settings-input" type="number" min="0" max="100" step="1" v-model.number="cfg.triggerPercent" />
        </label>
      </div>

      <p v-if="cfg.triggerMode === 'manual'" class="hint">
        manual の場合は自動投稿されません（手動投稿のみ）。
      </p>
    </section>

    <section class="settings-group">
      <TemplateEditor v-model="cfg.template" :sampleInfo="sampleInfo" label="Post text template" />
      <TemplateEditor
        v-if="cfg.cwEnabled"
        v-model="cfg.cwTemplate"
        :sampleInfo="sampleInfo"
        label="CW (visible) template"
      />
      <p v-if="cfg.cwEnabled" class="hint">
        CW が表示側、本文は隠される側として投稿されます。
      </p>
    </section>

    <details class="settings-group">
      <summary class="group-title">Advanced</summary>
      <div class="grid advanced">
        <label class="input-label">
          Dedupe cooldown (sec)
          <input class="settings-input" type="number" min="0" step="1" v-model.number="cfg.dedupeCooldownSec" />
        </label>

        <label class="input-label">
          Repeat behavior
          <select class="settings-input" v-model="cfg.repeatBehavior">
            <option value="skip">skip</option>
            <option value="allow">allow</option>
          </select>
        </label>

        <label class="input-label">
          Retries
          <input class="settings-input" type="number" min="0" step="1" v-model.number="cfg.retries" />
        </label>

        <label class="input-label">
          Retry backoff (sec)
          <input class="settings-input" type="number" min="1" step="1" v-model.number="cfg.retryBackoffSec" />
        </label>

        <label class="switch">
          <input type="checkbox" v-model="cfg.enableManualMenu" />
          <span>Add “Post now” menu entry</span>
        </label>

        <label class="switch">
          <input type="checkbox" v-model="cfg.useRPC" />
          <span>Use RPC fallback</span>
        </label>

        <label v-if="cfg.useRPC" class="input-label">
          RPC Base URL
          <input class="settings-input" v-model="cfg.rpcBaseUrl" placeholder="http://localhost:10767" />
        </label>

        <label v-if="cfg.useRPC" class="input-label">
          RPC Auth Token (optional)
          <input class="settings-input" v-model="cfg.rpcAuthToken" />
        </label>

        <label class="input-label">
          Poll interval (ms)
          <input class="settings-input" type="number" min="500" step="500" v-model.number="cfg.pollIntervalMs" />
        </label>

        <label class="input-label">
          Log level
          <select class="settings-input" v-model="cfg.logLevel">
            <option value="debug">debug</option>
            <option value="info">info</option>
            <option value="error">error</option>
          </select>
        </label>
      </div>
    </details>
  </div>
</template>

<style scoped>
.settings-container {
  padding: 1.25rem;
  max-width: 760px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.header {
  display: grid;
  gap: 6px;
}

.settings-title {
  font-size: 1.6rem;
  margin: 0;
  color: var(--color-text-primary, #fff);
}

.settings-subtitle {
  margin: 0;
  color: var(--color-text-tertiary, #a1a1aa);
  font-size: 0.95rem;
}

.settings-group {
  background: var(--color-background-secondary, rgba(255, 255, 255, 0.06));
  border-radius: 14px;
  padding: 14px;
  border: 1px solid var(--color-border, rgba(255, 255, 255, 0.1));
}

.group-title {
  font-size: 1.05rem;
  margin: 0 0 10px;
  color: var(--color-text-primary, #fff);
  font-weight: 800;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px;
  align-items: end;
}

.input-label {
  display: grid;
  gap: 6px;
  color: var(--color-text-secondary, #d4d4d8);
  font-weight: 650;
}

.settings-input {
  width: 100%;
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--color-border, rgba(255, 255, 255, 0.14));
  border-radius: 10px;
  background: var(--color-background-primary, rgba(0, 0, 0, 0.2));
  color: var(--color-text-primary, #fff);
  transition: all 0.2s ease;
}

.settings-input:focus {
  outline: none;
  border-color: var(--color-primary, #3b82f6);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.25);
}

.switch {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--color-text-primary, #fff);
  font-weight: 650;
  user-select: none;
}

.switch input {
  width: 18px;
  height: 18px;
}

.hint {
  margin: 10px 0 0;
  color: var(--color-text-tertiary, #a1a1aa);
  font-size: 12px;
}

details.settings-group > summary {
  cursor: pointer;
  list-style: none;
}

details.settings-group > summary::-webkit-details-marker {
  display: none;
}

.advanced {
  margin-top: 12px;
}
</style>
