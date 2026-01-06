# Misskey NowPlaying for Cider 2

**(Requires Cider 2.5 or later)**

Automatically (or manually) post your Cider Now Playing track to Misskey.

## Starting a new plugin project

Using **Node**

```bash
npx giget github:ciderapp/plugin-template your-plugin-name
```

Using **Bun**

```bash
bunx giget github:ciderapp/plugin-template your-plugin-name
```

## Available Commands

- `npm run dev` - Start development server, Cider can then listen to this server when you select "Enable Vite" from the main menu
- `npm run build` - Build the plugin to `dist/{plugin.config.ts:identifier}`
- `npm run prepare-marketplace` - Prepare a ZIP package in the correct format for the Cider Marketplace

## How to install after build

- Copy `dist/{plugin.config.ts:identifier}` to the `/plugins` directory of your Cider app data directory
  - On Windows, this is `%APPDATA%\C2Windows\plugins`
  - On macOS, this is `~/Library/Application Support/sh.cider.electron/plugins`
  - On Linux, this is `~/.config/sh.cider.electron/plugins`

## Preparing a ZIP package for the Cider Marketplace

Run `npm run prepare-marketplace`

Running this script will create a ZIP file in the `publish` directory that is ready to be uploaded to the Cider Marketplace.

To configure this plugin edit `src/plugin.config.ts`

## How to use (dev flow)

1) `pnpm dev` (or `npm run dev`) to expose Vite dev server.
2) In Cider → Plugins → Enable Vite → load this plugin.
3) Open menu item **“Misskey NowPlaying (settings)”** to configure:
   - Instance URL, token (`write:notes`), visibility/localOnly
   - Autopost toggle and trigger (instant / seconds / percent / manual)
   - Template text (placeholders like `{title}`, `{artist}`, `{album}`, `{elapsed_s}`, `{duration_s}`, etc.)
4) Optional: enable the menu entry “Post current track to Misskey” for one-click manual posting.
5) Check logs and preview on the plugin page; console logs also appear in Vite terminal / Cider DevTools.