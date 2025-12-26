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
  <div class="q-pa-lg plugin-base">
    <h1 class="apple-heading">Misskey NowPlaying</h1>
    <p class="caption">自動投稿と手動投稿の管理ページ（開発用ログ込み）</p>

    <section class="card">
      <header>
        <h3>現在のトラック</h3>
        <span class="pill" v-if="poster?.state?.isPosting">Posting…</span>
      </header>
      <div v-if="lastTrack">
        <div class="row">
          <div class="label">Title</div>
          <div>{{ lastTrack.name }}</div>
        </div>
        <div class="row">
          <div class="label">Artist</div>
          <div>{{ lastTrack.artistName }}</div>
        </div>
        <div class="row">
          <div class="label">Album</div>
          <div>{{ lastTrack.albumName }}</div>
        </div>
        <div class="row">
          <div class="label">Elapsed</div>
          <div>{{ Math.round(lastTrack.currentPlaybackTime ?? 0) }}s</div>
        </div>
        <div class="row">
          <div class="label">Duration</div>
          <div>{{ Math.round((lastTrack.durationInMillis ?? 0) / 1000) }}s</div>
        </div>
      </div>
      <div v-else>まだ再生情報を取得していません。</div>
      <div class="actions">
        <button class="c-btn" @click="manualPost">手動で今すぐ投稿</button>
      </div>
    </section>

    <section class="card">
      <header>
        <h3>テンプレート</h3>
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

    <section class="card">
      <header>
        <h3>設定</h3>
      </header>
      <div class="form-grid">
        <label>
          Misskey Instance URL
          <input
            class="c-input"
            v-model="cfg.instanceUrl"
            placeholder="https://misskey.io"
          />
        </label>
        <label>
          Token (write:notes)
          <input class="c-input" v-model="cfg.token" type="password" />
        </label>
        <label>
          Visibility
          <select class="c-select" v-model="cfg.visibility">
            <option value="public">public</option>
            <option value="home">home</option>
            <option value="followers">followers</option>
            <option value="direct">direct</option>
          </select>
        </label>
        <label class="checkbox">
          <input type="checkbox" v-model="cfg.localOnly" />
          localOnly
        </label>
        <label class="checkbox">
          <input type="checkbox" v-model="cfg.cwEnabled" />
          Use CW (content warning)
        </label>
        <label>
          RPC Base URL
          <input
            class="c-input"
            v-model="cfg.rpcBaseUrl"
            placeholder="http://localhost:10767"
          />
        </label>
        <label class="checkbox">
          <input type="checkbox" v-model="cfg.useRPC" />
          Use RPC fallback (requires Cider RPC enabled)
        </label>
        <label v-if="cfg.useRPC">
          RPC Auth Token (任意)
          <input class="c-input" v-model="cfg.rpcAuthToken" />
        </label>
        <label>
          Poll interval (ms)
          <input
            class="c-input"
            type="number"
            v-model.number="cfg.pollIntervalMs"
          />
        </label>
        <label>
          Log level
          <select class="c-select" v-model="cfg.logLevel">
            <option value="debug">debug</option>
            <option value="info">info</option>
            <option value="error">error</option>
          </select>
        </label>
        <label>
          Trigger mode
          <select class="c-select" v-model="cfg.triggerMode">
            <option value="instant">instant</option>
            <option value="seconds">seconds</option>
            <option value="percent">percent</option>
            <option value="manual">manual</option>
          </select>
        </label>
        <label v-if="cfg.triggerMode === 'seconds'">
          Threshold seconds
          <input
            class="c-input"
            type="number"
            min="0"
            step="1"
            v-model.number="cfg.triggerSeconds"
          />
        </label>
        <label v-if="cfg.triggerMode === 'percent'">
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
        <label>
          Dedupe cooldown (sec)
          <input
            class="c-input"
            type="number"
            v-model.number="cfg.dedupeCooldownSec"
          />
        </label>
        <label>
          Repeat behavior
          <select class="c-select" v-model="cfg.repeatBehavior">
            <option value="skip">skip</option>
            <option value="allow">allow</option>
          </select>
        </label>
        <label>
          Retries
          <input class="c-input" type="number" v-model.number="cfg.retries" />
        </label>
        <label>
          Retry backoff (sec)
          <input
            class="c-input"
            type="number"
            v-model.number="cfg.retryBackoffSec"
          />
        </label>
        <label class="checkbox">
          <input type="checkbox" v-model="cfg.autopost" />
          Autopost enabled
        </label>
        <label class="checkbox">
          <input type="checkbox" v-model="cfg.enableManualMenu" />
          Add manual post menu entry
        </label>
      </div>
    </section>

    <section class="card">
      <header>
        <h3>ログ (最新50件)</h3>
      </header>
      <div class="logs">
        <div
          v-for="entry in logs.logs.slice(0, 50)"
          :key="entry.id"
          class="log"
        >
          <span class="time">{{
            new Date(entry.at).toLocaleTimeString()
          }}</span>
          <span :class="['level', entry.level]">{{ entry.level }}</span>
          <span class="msg">{{ entry.message }}</span>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.card {
  background: var(--color-background-secondary, rgba(255, 255, 255, 0.05));
  border: 1px solid var(--color-border, rgba(255, 255, 255, 0.08));
  border-radius: 12px;
  padding: 24px;
  margin-top: 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  border-bottom: 1px solid var(--color-border, rgba(255, 255, 255, 0.08));
  padding-bottom: 12px;
}

h3 {
  margin: 0;
  color: var(--color-text-primary, inherit);
  font-size: 1.25rem;
  font-weight: 600;
}

.pill {
  background: var(--color-primary, #3b82f6);
  color: #fff;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.5px;
}

.row {
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: 16px;
  padding: 8px 0;
  border-bottom: 1px solid var(--color-border, rgba(255, 255, 255, 0.03));
}

.label {
  color: var(--color-text-secondary, #999);
  font-size: 13px;
  font-weight: 500;
}

.c-btn {
  background: var(--color-primary, #fb2a5d);
  color: #fff;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  transition: opacity 0.2s;
}

.c-input,
.c-select {
  background: var(--color-background-primary, rgba(0, 0, 0, 0.2));
  border: 1px solid var(--color-border, rgba(255, 255, 255, 0.1));
  color: var(--color-text-primary, inherit);
  padding: 10px 12px;
  border-radius: 8px;
  font-family: inherit;
  transition: border-color 0.2s;
}

.c-input:focus,
.c-select:focus {
  outline: none;
  border-color: var(--color-primary, #fb2a5d);
}

.checkbox input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: var(--color-primary, #fb2a5d);
}

.logs {
  max-height: 300px;
  overflow-y: auto;
  font-family: "Source Code Pro", monospace;
  font-size: 12px;
  background: var(--color-background-primary, rgba(0, 0, 0, 0.3));
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--color-border, rgba(255, 255, 255, 0.05));
}

.log {
  display: grid;
  grid-template-columns: 85px 60px 1fr;
  gap: 12px;
  padding: 4px 8px;
  border-radius: 4px;
}

.log:hover {
  background: rgba(255, 255, 255, 0.05);
}

.level {
  text-transform: uppercase;
  font-weight: bold;
  font-size: 11px;
  padding: 2px 0;
  text-align: center;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
}

.level.debug {
  color: #22d3ee;
  background: rgba(34, 211, 238, 0.1);
}
.level.info {
  color: #a3e635;
  background: rgba(163, 230, 53, 0.1);
}
.level.error {
  color: #f87171;
  background: rgba(248, 113, 113, 0.1);
}

/* Scrollbar styling for logs */
.logs::-webkit-scrollbar {
  width: 8px;
}
.logs::-webkit-scrollbar-track {
  background: transparent;
}
.logs::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}
.logs::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>
