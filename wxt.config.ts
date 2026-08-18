import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'ZTM Sidebar',
    description: 'Zero To Mastery courses in a side panel, playing in Picture-in-Picture.',
    permissions: [
      'sidePanel',
      'storage',
      'cookies',
      'scripting',
      'webRequest',
      'declarativeNetRequestWithHostAccess',
    ],
    // <all_urls> is what the inject-into-the-current-page mode costs: the
    // modal has to be buildable on whatever the user is looking at.
    host_permissions: ['<all_urls>'],
    action: { default_title: 'ZTM Sidebar' },
    // player.hotmart.com refuses to be framed by other origins. Stripping the
    // framing headers is what lets the side panel host the player at all, and
    // Rails rejects a write whose Origin is the extension, so that is set too.
    declarative_net_request: {
      rule_resources: [{ id: 'frame-headers', enabled: true, path: 'rules.json' }],
    },
  },
});
