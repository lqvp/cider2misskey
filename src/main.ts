import { defineCustomElement } from "vue";
import type { App } from "vue";
import { createPinia, setActivePinia } from "pinia";
import {
  definePluginContext,
  addMainMenuEntry,
  addMediaItemContextMenuEntry,
  addImmersiveMenuEntry,
  addImmersiveLayout,
  addCustomButton,
  useCiderAudio,
  useMusicKit,
} from "@ciderapp/pluginkit";
import MySettings from "./components/MySettings.vue";
import ModalExample from "./components/ModalExample.vue";
import CustomImmersiveLayout from "./components/CustomImmersiveLayout.vue";
import CustomPage from "./pages/CustomPage.vue";
import PluginConfig from "./plugin.config";
import ComponentBasedModal from "./components/ComponentBasedModal.vue";
import ComponentsShowcase from "./pages/ComponentsShowcase.vue";
import NowPlayingPage from "./pages/NowPlayingPage.vue";
import { initNowPlayingPoster, useNowPlayingPoster } from "./services/nowPlayingPoster";
import { useLogStore } from "./stores/logs";
import { cfg } from "./config";

/**
 * Initializing a Vue app instance so we can use things like Pinia.
 */
const pinia = createPinia();
setActivePinia(pinia);

/**
 * Function that configures the app instances of the custom elements
 */
function configureApp(app: App) {
  app.use(pinia);
}

/**
 * Custom Elements that will be registered in the app
 */
export const CustomElements = {
  "modal-example": defineCustomElement(ModalExample, {
    shadowRoot: false,
    configureApp,
  }),
  "page-helloworld": defineCustomElement(CustomPage, {
    shadowRoot: false,
    configureApp,
  }),
  "page-components": defineCustomElement(ComponentsShowcase, {
    shadowRoot: false,
    configureApp,
  }),
  "page-nowplaying": defineCustomElement(NowPlayingPage, {
    shadowRoot: false,
    configureApp,
  }),
  "immersive-layout": defineCustomElement(CustomImmersiveLayout, {
    shadowRoot: false,
    configureApp,
  }),
  "component-based-modal": defineCustomElement(ComponentBasedModal, {
    shadowRoot: false,
    configureApp,
  }),
};

/**
 * Defining the plugin context
 */
const { plugin, customElementName, goToPage, useCPlugin } =
  definePluginContext({
    ...PluginConfig,
    CustomElements,
    setup() {
      /**
       * Registering the custom elements in the app
       */
      for (const [key, value] of Object.entries(CustomElements)) {
        const _key = key as keyof typeof CustomElements;
        customElements.define(customElementName(_key), value);
      }

      // Explicitly defining our settings element here to avoid issues with module load order
      customElements.define(
        customElementName("settings"),
        defineCustomElement(MySettings, {
          shadowRoot: false,
          configureApp,
        })
      );

      /**
       * Defining our custom settings element
       */
      this.SettingsElement = customElementName("settings");

      addImmersiveLayout({
        name: "My layout",
        identifier: "my-layout",
        component: customElementName("immersive-layout"),
        type: "normal",
      });

      const logStore = useLogStore();
      logStore.log("info", "Misskey NowPlaying plugin booting");

      const poster = initNowPlayingPoster(cfg);
      const mk = useMusicKit();
      mk.addEventListener("mediaItemStateDidChange", () => poster?.onMediaItemChange(mk));
      mk.addEventListener("playbackStateDidChange", () => poster?.onMediaItemChange(mk));

      addMainMenuEntry({
        label: "Misskey NowPlaying (settings)",
        onClick() {
          goToPage({
            name: "page-nowplaying",
          });
        },
      });

      if (cfg.value.enableManualMenu) {
        addMainMenuEntry({
          label: "Post current track to Misskey",
          onClick: () => {
            poster?.manualPost(true);
          },
        });
      }

      addImmersiveMenuEntry({
        label: "Misskey NowPlaying",
        onClick() {
          goToPage({
            name: "page-nowplaying",
          });
        },
      });

      addCustomButton({
        element: "♪",
        location: "chrome-top/right",
        title: "Misskey NowPlaying",
        onClick() {
          poster?.manualPost(true);
          logStore.log("info", "Manual post requested from custom button");
        },
      });

      const audio = useCiderAudio();
      audio.subscribe("ready", () => {
        logStore.log("debug", "CiderAudio ready");
      });

      addMediaItemContextMenuEntry({
        label: "Post this track to Misskey",
        onClick(item) {
          const npPoster = useNowPlayingPoster();
          // @ts-ignore
          npPoster?.manualPost(true);
          logStore.log("info", "Manual post requested from context menu", {
            item,
          });
        },
      });
    },
  });

/**
 * Exporting the plugin and functions
 */
export { customElementName, goToPage, useCPlugin };

/**
 * Exporting the plugin, Cider will use this to load the plugin
 */
export default plugin;
