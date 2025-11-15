/**
 * Markdown 渲染器配置和自定义插件
 */
import MarkdownIt from 'markdown-it';
import {tasklist} from "@mdit/plugin-tasklist";
import {katex} from "@mdit/plugin-katex";
import markPlugin from "@/common/markdown-it/plugins/markdown-it-mark";
import hljs from 'highlight.js';
import 'highlight.js/styles/default.css';
import {full as emoji} from '@/common/markdown-it/plugins/markdown-it-emoji/'
import footnote_plugin from "@/common/markdown-it/plugins/markdown-it-footnote"
import sup_plugin from "@/common/markdown-it/plugins/markdown-it-sup"
import ins_plugin from "@/common/markdown-it/plugins/markdown-it-ins"
import deflist_plugin from "@/common/markdown-it/plugins/markdown-it-deflist"
import abbr_plugin from "@/common/markdown-it/plugins/markdown-it-abbr"
import sub_plugin from "@/common/markdown-it/plugins/markdown-it-sub"
import {MermaidIt} from "@/common/markdown-it/plugins/markdown-it-mermaid"
import {useThemeStore} from '@/stores/themeStore'

/**
 * 自定义链接插件：使用 data-href 替代 href，配合事件委托实现自定义跳转
 */
export function customLinkPlugin(md: MarkdownIt) {
    // 保存默认的 link_open 渲染器
    const defaultRender = md.renderer.rules.link_open || function (tokens, idx, options, env, self) {
        return self.renderToken(tokens, idx, options);
    };

    // 重写 link_open 渲染器
    md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
        const token = tokens[idx];

        // 获取 href 属性
        const hrefIndex = token.attrIndex('href');
        if (hrefIndex >= 0) {
            const href = token.attrs![hrefIndex][1];

            // 添加 data-href 属性保存原始链接
            token.attrPush(['data-href', href]);

            // 添加 class 用于样式
            const classIndex = token.attrIndex('class');
            if (classIndex < 0) {
                token.attrPush(['class', 'markdown-link']);
            } else {
                token.attrs![classIndex][1] += ' markdown-link';
            }

            // 移除 href 属性，防止默认跳转
            token.attrs!.splice(hrefIndex, 1);
        }

        return defaultRender(tokens, idx, options, env, self);
    };
}

/**
 * 创建 Markdown-It 实例
 */
export function createMarkdownRenderer(): MarkdownIt {
    const themeStore = useThemeStore();
    const mermaidTheme = themeStore.isDarkMode ? "dark" : "default";
    
    return new MarkdownIt({
        html: true,
        linkify: true,
        typographer: true,
        breaks: true,
        langPrefix: "language-",
        highlight: (code, lang) => {
            // 对于大代码块（>1000行），跳过高亮以提升性能
            if (code.length > 50000) {
                return `<pre><code>${code}</code></pre>`;
            }
            
            if (lang && hljs.getLanguage(lang)) {
                try {
                    return hljs.highlight(code, {language: lang, ignoreIllegals: true}).value;
                } catch (error) {
                    console.warn(`Failed to highlight code block with language: ${lang}`, error);
                    return code;
                }
            }
            
            // 对于中等大小的代码块（>5000字符），跳过自动检测
            if (code.length > 5000) {
                return code;
            }
            
            // 小代码块才使用自动检测
            try {
                return hljs.highlightAuto(code).value;
            } catch (error) {
                console.warn('Failed to auto-highlight code block', error);
                return code;
            }
        }
    })
        .use(tasklist, {
            disabled: false,
        })
        .use(customLinkPlugin)
        .use(markPlugin)
        .use(emoji)
        .use(footnote_plugin)
        .use(sup_plugin)
        .use(ins_plugin)
        .use(deflist_plugin)
        .use(abbr_plugin)
        .use(sub_plugin)
        .use(katex)
        .use(MermaidIt, {
            theme: mermaidTheme
        });
}


