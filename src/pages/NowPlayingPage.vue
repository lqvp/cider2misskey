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
      <TemplateEditor v-model="cfg.template" :sampleInfo="sampleInfo" />
    </section>

    <section class="card">
      <header>
        <h3>設定</h3>
      </header>
      <div class="form-grid">
        <label>
          Misskey Instance URL
          <input class="c-input" v-model="cfg.instanceUrl" placeholder="https://misskey.io" />
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
        <label>
          RPC Base URL
          <input class="c-input" v-model="cfg.rpcBaseUrl" placeholder="http://localhost:10767" />
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
          <input class="c-input" type="number" v-model.number="cfg.pollIntervalMs" />
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
          <input class="c-input" type="number" min="0" step="1" v-model.number="cfg.triggerSeconds" />
        </label>
        <label v-if="cfg.triggerMode === 'percent'">
          Threshold percent
          <input class="c-input" type="number" min="0" max="100" step="1" v-model.number="cfg.triggerPercent" />
        </label>
        <label>
          Dedupe cooldown (sec)
          <input class="c-input" type="number" v-model.number="cfg.dedupeCooldownSec" />
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
          <input class="c-input" type="number" v-model.number="cfg.retryBackoffSec" />
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
        <div v-for="entry in logs.logs.slice(0, 50)" :key="entry.id" class="log">
          <span class="time">{{ new Date(entry.at).toLocaleTimeString() }}</span>
          <span :class="['level', entry.level]">{{ entry.level }}</span>
          <span class="msg">{{ entry.message }}</span>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 16px;
  margin-top: 16px;
}
header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.pill {
  background: #3b82f6;
  color: #fff;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
}
.row {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 8px;
  padding: 4px 0;
}
.label {
  color: #999;
  font-size: 12px;
}
.actions {
  margin-top: 8px;
}
.preview pre {
  background: rgba(0, 0, 0, 0.3);
  padding: 8px;
  border-radius: 8px;
  white-space: pre-wrap;
}
.placeholder-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.tag {
  background: rgba(255, 255, 255, 0.1);
  padding: 4px 8px;
  border-radius: 6px;
  font-family: "Source Code Pro", monospace;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}
.checkbox {
  display: flex;
  gap: 8px;
  align-items: center;
}
.logs {
  max-height: 240px;
  overflow: auto;
  font-family: "Source Code Pro", monospace;
  font-size: 12px;
  background: rgba(0, 0, 0, 0.2);
  padding: 8px;
  border-radius: 8px;
}
.log {
  display: grid;
  grid-template-columns: 80px 70px 1fr;
  gap: 6px;
  padding: 2px 0;
}
.level {
  text-transform: uppercase;
}
.level.debug {
  color: #22d3ee;
}
.level.info {
  color: #a3e635;
}
.level.error {
  color: #f87171;
}
</style>
