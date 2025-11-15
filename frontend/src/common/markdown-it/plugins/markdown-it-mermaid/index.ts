import mermaid from "mermaid";
import {genUid, hashCode, sleep} from "./utils";

const mermaidCache = new Map<string, HTMLElement>();

// 缓存计数器，用于清除缓存
const mermaidCacheCount = new Map<string, number>();
let count = 0;


let countTmo = setTimeout(() => undefined, 0);
const addCount = () => {
    clearTimeout(countTmo);
    countTmo = setTimeout(() => {
        count++;
        clearCache();
    }, 500);
};

const clearCache = () => {
    for (const key of mermaidCacheCount.keys()) {
        const value = mermaidCacheCount.get(key)!;
        if (value + 3 < count) {
            mermaidCache.delete(key);
            mermaidCacheCount.delete(key);
        }
    }
};

/**
 * 渲染 mermaid
 * @param code mermaid 代码
 * @param targetId 目标 id
 * @param count 计数器
 */
const renderMermaid = async (code: string, targetId: string, count: number) => {
    let limit = 100;
    while (limit-- > 0) {
        const container = document.getElementById(targetId);
        if (!container) {
            await sleep(100);
            continue;
        }
        try {
            const {svg} = await mermaid.render("mermaid-svg-" + genUid(), code, container);
            container.innerHTML = svg;
            mermaidCache.set(targetId, container);
            mermaidCacheCount.set(targetId, count);
        } catch (e) {
        }
        break;
    }
};

export interface MermaidItOptions {
    theme?: "default" | "dark" | "forest" | "neutral" | "base";
}

/**
 * 更新 mermaid 主题
 */
export const updateMermaidTheme = (theme: "default" | "dark" | "forest" | "neutral" | "base") => {
    mermaid.initialize({
        startOnLoad: false,
        theme: theme
    });
    // 清空缓存，强制重新渲染
    mermaidCache.clear();
    mermaidCacheCount.clear();

};

/**
 * mermaid 插件
 * @param md markdown-it
 * @param options 配置选项
 * @constructor MermaidIt
 */
export const MermaidIt = function (md: any, options?: MermaidItOptions): void {
    const theme = options?.theme || "default";
    mermaid.initialize({
        startOnLoad: false,
        theme: theme
    });
    const defaultRenderer = md.renderer.rules.fence.bind(md.renderer.rules);
    md.renderer.rules.fence = (tokens: any, idx: any, options: any, env: any, self: any) => {
        addCount();
        const token = tokens[idx];
        const info = token.info.trim();
        if (info === "mermaid") {
            const containerId = "mermaid-container-" + hashCode(token.content);
            const container = document.createElement("div");
            container.id = containerId;
            if (mermaidCache.has(containerId)) {
                container.innerHTML = mermaidCache.get(containerId)!.innerHTML;
                mermaidCacheCount.set(containerId, count);
            } else {
                renderMermaid(token.content, containerId, count).then();
            }
            return container.outerHTML;
        }
        // 使用默认的渲染规则
        return defaultRenderer(tokens, idx, options, env, self);
    };
};

