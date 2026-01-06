import { Ref, ref, watch } from "vue";
import { useCider } from "@ciderapp/pluginkit";
import { clone, merge } from "lodash";
import PluginConfig from "./plugin.config";
import type { NowPlayingConfig } from "./services/nowPlayingPoster";

function setupConfig<T extends Record<string, any>>(defaults: T): Ref<T> {
  const cfg = { ...defaults };
  const cider = useCider();
  // @ts-ignore - Cider exposes a reactive config ref at runtime
  const appConfig = cider.config.getRef();
  const { identifier } = PluginConfig;

  if (!appConfig["plugins"]) {
    appConfig["plugins"] = {};
  }
  if (!appConfig["plugins"][identifier]) {
    appConfig["plugins"][identifier] = {};
  }

  const pluginConfig = appConfig["plugins"][identifier];
  appConfig["plugins"][identifier] = merge(cfg, pluginConfig);

  const cfgRef = ref(clone(appConfig["plugins"][identifier]));

  watch(
    cfgRef,
    (newVal) => {
      appConfig["plugins"][identifier] = newVal;
    },
    { deep: true }
  );

  return cfgRef as Ref<T>;
}

export const defaultConfig: NowPlayingConfig = {
  instanceUrl: "",
  token: "",
  visibility: "public",
  localOnly: false,
  template: "{title} - {artist} / {album}\n{url}\n#NowPlaying",
  cwEnabled: false,
  cwTemplate: "Now Playing",
  autopost: true,
  triggerMode: "percent",
  triggerSeconds: 15,
  triggerPercent: 20,
  dedupeCooldownSec: 600,
  repeatBehavior: "skip",
  retries: 2,
  retryBackoffSec: 2,
  rpcBaseUrl: "http://localhost:10767",
  rpcAuthToken: "",
  useRPC: false,
  pollIntervalMs: 5000,
  logLevel: "info",
  enableManualMenu: true,
};

export const cfg = setupConfig(defaultConfig);

export function useConfig() {
  return cfg.value;
}
