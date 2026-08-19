import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
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
