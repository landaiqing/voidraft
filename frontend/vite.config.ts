import {defineConfig, loadEnv} from 'vite';
import vue from '@vitejs/plugin-vue';
import Components from 'unplugin-vue-components/vite';
import * as path from 'path';
import {nodePolyfills} from 'vite-plugin-node-polyfills'

export default defineConfig(({mode}: { mode: string }): object => {
    const env: Record<string, string> = loadEnv(mode, process.cwd());
    return {
        publicDir: './public',
        base: './',
        resolve: {
            alias: {
                '@': path.resolve(__dirname, 'src')
            }
        },
        plugins: [
            vue(),
            nodePolyfills({
                include: [],
                exclude: [],
                // Whether to polyfill specific globals.
                globals: {
                    Buffer: true, // can also be 'build', 'dev', or false
                    global: true,
                    process: true,
                },
                // Whether to polyfill `node:` protocol imports.
                protocolImports: true,
            }),
            Components({
                dts: true,
                dirs: ['src/components'],
                resolvers: [],
            })
        ],
        esbuild: {
            drop: env.VITE_NODE_ENV === 'production' ? ['console', 'debugger'] : [],
        },
        build: {
            outDir: "dist",
            assetsDir: "assets",
            assetsInlineLimit: 2048, // 减少内联资源阈值以减少bundle大小
            cssCodeSplit: true,
            sourcemap: false,
            minify: "esbuild",
            write: true,
            emptyOutDir: true,
            brotliSize: false, // 跳过 brotli 压缩分析
            chunkSizeWarningLimit: 5000,
            watch: null,
            reportCompressedSize: false, // 跳过压缩大小报告
            rollupOptions: {
                output: {
                    chunkFileNames: 'js/[name]-[hash].js',
                    entryFileNames: 'js/[name]-[hash].js',
                    assetFileNames: '[ext]/[name]-[hash].[ext]',
                },
            }
        }
    }
});
