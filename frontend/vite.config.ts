import {defineConfig, loadEnv} from 'vite';
import vue from '@vitejs/plugin-vue';
import Components from 'unplugin-vue-components/vite';
import * as path from 'path';
import {nodePolyfills} from 'vite-plugin-node-polyfills'
import {visualizer} from 'rollup-plugin-visualizer'

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
            nodePolyfills(),
            visualizer({open: false,
                filename: 'visualizer.html',
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
            chunkSizeWarningLimit: 1000,
            watch: null,
            reportCompressedSize: false, // 跳过压缩大小报告
            rollupOptions: {
                maxParallelFileOps: 2,
                treeshake: {
                    moduleSideEffects: false,
                    propertyReadSideEffects: false,
                    tryCatchDeoptimization: false
                },
                output: {
                    format: 'es',
                    chunkFileNames: 'js/[name]-[hash].js',
                    entryFileNames: 'js/[name]-[hash].js',
                    assetFileNames: '[ext]/[name]-[hash].[ext]',
                    compact: true,
                    manualChunks(id: string) {
                        // CodeMirror
                        if (id.includes('@codemirror') || id.includes('codemirror')) {
                            return 'codemirror';
                        }
                        // Vue
                        if (id.includes('vue') && !id.includes('vue-pick-colors')) {
                            return 'vue';
                        }
                        // Lezer
                        if (id.includes('@lezer') || id.includes('lezer')) {
                            return 'lezer';
                        }
                        // Prettier
                        if (id.includes('prettier')) {
                            return 'prettier';
                        }
                        // Taplo
                        if (id.includes('@taplo') || id.includes('taplo')) {
                            return 'taplo';
                        }
                        // Linguist languages
                        if (id.includes('franc-min') || id.includes('linguist-languages')) {
                            return 'lang-detect';
                        }
                        // Java parser
                        if (id.includes('java-parser')) {
                            return 'java-parser';
                        }
                        // PHP parser
                        if (id.includes('php-parser')) {
                            return 'php-parser';
                        }
                        // SQL parser
                        if (id.includes('node-sql-parser') || id.includes('sql-formatter')) {
                            return 'sql-parser';
                        }
                        // Rust tools
                        if (id.includes('jinx-rust') || id.includes('sh-syntax')) {
                            return 'rust-tools';
                        }
                        // Color utils
                        if (id.includes('colors-named') || id.includes('hsl-matcher')) {
                            return 'color-utils';
                        }
                        // Pinia
                        if (id.includes('pinia')) {
                            return 'pinia';
                        }
                        // Vue Router
                        if (id.includes('vue-router')) {
                            return 'vue-router';
                        }
                        // Vue i18n
                        if (id.includes('vue-i18n')) {
                            return 'vue-i18n';
                        }
                        // Vendor
                        if (id.includes("node_modules")) {
                            return 'vendor';
                        }
                    }
                },
            }
        }
    }
});
