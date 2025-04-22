import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite';
import {PrimeVueResolver} from '@primevue/auto-import-resolver';
import * as path from 'path';

export default defineConfig({
  publicDir: './public',
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  plugins: [
    vue(),
    Components({
      dts: true,
      dirs: ['src/components'],
      resolvers: [PrimeVueResolver()],
    })
  ]
})
