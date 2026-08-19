import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  // Tailwind v4 has no config file; the vite hook is what reaches every entrypoint.
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'ZTM Sidebar',
    description: 'Zero To Mastery courses in a side panel, playing in Picture-in-Picture.',
    permissions: ['sidePanel', 'storage'],
    action: { default_title: 'ZTM Sidebar' },
  },
});
