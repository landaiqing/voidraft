import {defineConfig} from 'vitepress'
const base = '/voidraft/'
// https://vitepress.dev/reference/site-config
export default defineConfig({
    base: base,
    title: "voidraft",
    description: "An elegant text snippet recording tool designed for developers.",
    srcDir: 'src',
    assetsDir: 'assets',
    cacheDir: './.vitepress/cache',
    outDir: './.vitepress/dist',
    srcExclude: [],
    ignoreDeadLinks: false,
    head: [
        ["link", {rel: "icon", type: "image/png", href: `${base}/icon/favicon-96x96.png`, sizes: "96x96"}],
        ["link", {rel: "icon", type: "image/svg+xml", href: `${base}/icon/favicon.svg`}],
        ["link", {rel: "shortcut icon", href: `${base}/icon/favicon.ico`}],
        ["link", {rel: "apple-touch-icon", sizes: "180x180", href: `${base}/icon/apple-touch-icon.png`}],
        ["meta", {name: "apple-mobile-web-app-title", content: "voidraft"}],
        ["link", {rel: "manifest", href: `${base}/icon/site.webmanifest`}],
        ['meta', {name: 'viewport', content: 'width=device-width,initial-scale=1'}]
    ],

    // 国际化配置
    locales: {
        root: {
            label: 'English',
            lang: 'en-US',
            description: 'An elegant text snippet recording tool designed for developers.',
            themeConfig: {
                logo: '/icon/logo.png',
                siteTitle: 'voidraft',
                nav: [
                    {text: 'Home', link: '/'},
                    {text: 'Guide', link: '/guide/introduction'}
                ],
                sidebar: {
                    '/guide/': [
                        {
                            text: 'Getting Started',
                            items: [
                                {text: 'Introduction', link: '/guide/introduction'},
                                {text: 'Installation', link: '/guide/installation'},
                                {text: 'Quick Start', link: '/guide/getting-started'}
                            ]
                        },
                        {
                            text: 'Features',
                            items: [
                                {text: 'Overview', link: '/guide/features'}
                            ]
                        }
                    ]
                },
                socialLinks: [
                    {icon: 'github', link: 'https://github.com/landaiqing/voidraft'}
                ],
                outline: {
                    label: 'On this page'
                },
                lastUpdated: {
                    text: 'Last updated'
                },
                docFooter: {
                    prev: 'Previous',
                    next: 'Next'
                },
                darkModeSwitchLabel: 'Appearance',
                sidebarMenuLabel: 'Menu',
                returnToTopLabel: 'Return to top',
                footer: {
                    message: 'Released under the MIT License.',
                    copyright: 'Copyright © 2025-present landaiqing'
                }
            }
        },
        zh: {
            label: '简体中文',
            lang: 'zh-CN',
            link: '/zh/',
            description: '一个为开发者设计的优雅文本片段记录工具',
            themeConfig: {
                logo: '/icon/logo.png',
                siteTitle: 'voidraft',
                nav: [
                    {text: '首页', link: '/zh/'},
                    {text: '指南', link: '/zh/guide/introduction'}
                ],
                sidebar: {
                    '/zh/guide/': [
                        {
                            text: '开始使用',
                            items: [
                                {text: '简介', link: '/zh/guide/introduction'},
                                {text: '安装', link: '/zh/guide/installation'},
                                {text: '快速开始', link: '/zh/guide/getting-started'}
                            ]
                        },
                        {
                            text: '功能特性',
                            items: [
                                {text: '功能概览', link: '/zh/guide/features'}
                            ]
                        }
                    ]
                },
                socialLinks: [
                    {icon: 'github', link: 'https://github.com/landaiqing/voidraft'}
                ],
                outline: {
                    label: '本页目录'
                },
                lastUpdated: {
                    text: '最后更新'
                },
                docFooter: {
                    prev: '上一页',
                    next: '下一页'
                },
                darkModeSwitchLabel: '外观',
                sidebarMenuLabel: '菜单',
                returnToTopLabel: '返回顶部',
                footer: {
                    message: 'Released under the MIT License.',
                    copyright: 'Copyright © 2025-present landaiqing'
                }
            }
        }
    }
})
