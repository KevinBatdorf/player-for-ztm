import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  // Away from 3000: WXT takes the first free port from there, and binding [::1]
  // shadows anything else holding the wildcard. Pinning the
  // v4 loopback on both ends keeps `localhost` resolution out of it, since the
  // extension page and the server otherwise disagree about which one it means.
  dev: {
    server: { host: '127.0.0.1', port: 7331, origin: 'http://127.0.0.1:7331', strictPort: true },
  },
  // Tailwind v4 has no config file; the vite hook is what reaches every entrypoint.
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'Player for ZTM',
    description: 'Zero To Mastery courses in a side panel, playing in Picture-in-Picture.',
    permissions: ['sidePanel', 'storage'],
    // The session check reads a page that only answers with cookies attached.
    host_permissions: ['https://academy.zerotomastery.io/*'],
    action: { default_title: 'Player for ZTM' },
  },
});
