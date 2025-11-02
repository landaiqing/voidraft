import {defineConfig} from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
    title: "voidraft",
    description: "An elegant text snippet recording tool designed for developers.",
    lang: 'zh-CN',
    srcDir: 'src',
    assetsDir: 'assets',
    cacheDir: './.vitepress/cache',
    outDir: './.vitepress/dist',
    srcExclude: [],
    ignoreDeadLinks: false,
    head: [
        [
            "link",
            {
                rel: "icon",
                type: "image/png",
                href: "/static/icon/favicon-96x96.png",
                sizes: "96x96",
            },
        ],
        [
            "link",
            {
                rel: "icon",
                type: "image/svg+xml",
                href: "/static/icon/favicon.svg",
            },
        ],
        [
            "link",
            {
                rel: "shortcut icon",
                href: "/static/icon/favicon.ico",
            },
        ],
        [
            "link",
            {
                rel: "apple-touch-icon",
                sizes: "180x180",
                href: "/static/icon/apple-touch-icon.png",
            },
        ],
        [
            "meta",
            {
                name: "apple-mobile-web-app-title",
                content: "voidraft",
            },
        ],
        [
            "link",
            {
                rel: "manifest",
                href: "/static/icon/site.webmanifest",
            },
        ],
        ['meta', {name: 'viewport', content: 'width=device-width,initial-scale=1'}]
    ],
    themeConfig: {
        logo: '/static/icon/logo.png',
        siteTitle: 'voidraft',
        // https://vitepress.dev/reference/default-theme-config
        nav: [
            {text: 'Home', link: '/'},
            {text: 'Examples', link: '/markdown-examples'}
        ],

        sidebar: [
            {
                text: 'Examples',
                items: [
                    {text: 'Markdown Examples', link: '/markdown-examples'},
                    {text: 'Runtime API Examples', link: '/api-examples'}
                ]
            }
        ],

        socialLinks: [
            {icon: 'github', link: 'https://github.com/landaiqing/voidraft'}
        ]
    }
})
