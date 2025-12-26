/**
 * Plugin configuration.
 */
export default {
    /**
     * Custom element prefix, must be unique
     */
    ce_prefix: 'cider-misskey-nowplaying',
    identifier: 'sh.cider.misskey-nowplaying',
    name: 'Misskey NowPlaying',
    description: 'Auto-post now playing from Cider to Misskey',
    version: '1.0.0',
    author: 'cider2misskey',
    repo: 'https://github.com/ciderapp/plugin-template',
    entry: {
        'plugin.js': {
            type: 'main',
        }
    }
}
