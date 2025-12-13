import {Manager} from './manager';
import i18n from '@/i18n';
import {ExtensionDefinition} from './types';
import {Prec} from '@codemirror/state';

import rainbowBrackets from '../extensions/rainbowBracket';
import {color} from '../extensions/colorSelector';
import {hyperLink} from '../extensions/hyperlink';
import {minimap} from '../extensions/minimap';
import {vscodeSearch} from '../extensions/vscodeSearch';
import {createTranslatorExtension} from '../extensions/translator';
import markdownExtensions from '../extensions/markdown';
import {foldGutter} from "@codemirror/language";
import {highlightActiveLineGutter, highlightWhitespace, highlightTrailingWhitespace} from "@codemirror/view";
import createEditorContextMenu from '../extensions/contextMenu';
import {blockLineNumbers} from '../extensions/codeblock';
import {createHttpClientExtension} from '../extensions/httpclient';
import {ExtensionKey} from '@/../bindings/voidraft/internal/models/models';

type ExtensionEntry = {
    definition: ExtensionDefinition
    displayNameKey: string
    descriptionKey: string
};

// 排除 $zero 的有效扩展 Key 类型
type ValidExtensionKey = Exclude<ExtensionKey, ExtensionKey.$zero>;

const defineExtension = (create: (config: any) => any, defaultConfig: Record<string, any> = {}): ExtensionDefinition => ({
    create,
    defaultConfig
});

const EXTENSION_REGISTRY: Record<ValidExtensionKey, ExtensionEntry> = {
    [ExtensionKey.ExtensionRainbowBrackets]: {
        definition: defineExtension(() => rainbowBrackets()),
        displayNameKey: 'extensions.rainbowBrackets.name',
        descriptionKey: 'extensions.rainbowBrackets.description'
    },
    [ExtensionKey.ExtensionHyperlink]: {
        definition: defineExtension(() => hyperLink),
        displayNameKey: 'extensions.hyperlink.name',
        descriptionKey: 'extensions.hyperlink.description'
    },
    [ExtensionKey.ExtensionColorSelector]: {
        definition: defineExtension(() => color),
        displayNameKey: 'extensions.colorSelector.name',
        descriptionKey: 'extensions.colorSelector.description'
    },
    [ExtensionKey.ExtensionTranslator]: {
        definition: defineExtension(() => createTranslatorExtension()),
        displayNameKey: 'extensions.translator.name',
        descriptionKey: 'extensions.translator.description'
    },
    [ExtensionKey.ExtensionMinimap]: {
        definition: defineExtension((config: any) => minimap({
            displayText: config?.displayText ?? 'characters',
            showOverlay: config?.showOverlay ?? 'always',
            autohide: config?.autohide ?? false
        }), {
            displayText: 'characters',
            showOverlay: 'always',
            autohide: false
        }),
        displayNameKey: 'extensions.minimap.name',
        descriptionKey: 'extensions.minimap.description'
    },
    [ExtensionKey.ExtensionSearch]: {
        definition: defineExtension(() => vscodeSearch),
        displayNameKey: 'extensions.search.name',
        descriptionKey: 'extensions.search.description'
    },
    [ExtensionKey.ExtensionFold]: {
        definition: defineExtension(() => Prec.low(foldGutter())),
        displayNameKey: 'extensions.fold.name',
        descriptionKey: 'extensions.fold.description'
    },
    [ExtensionKey.ExtensionMarkdown]: {
        definition: defineExtension(() => markdownExtensions),
        displayNameKey: 'extensions.markdown.name',
        descriptionKey: 'extensions.markdown.description'
    },
    [ExtensionKey.ExtensionLineNumbers]: {
        definition: defineExtension(() => Prec.high([blockLineNumbers, highlightActiveLineGutter()])),
        displayNameKey: 'extensions.lineNumbers.name',
        descriptionKey: 'extensions.lineNumbers.description'
    },
    [ExtensionKey.ExtensionContextMenu]: {
        definition: defineExtension(() => createEditorContextMenu()),
        displayNameKey: 'extensions.contextMenu.name',
        descriptionKey: 'extensions.contextMenu.description'
    },
    [ExtensionKey.ExtensionHighlightWhitespace]: {
        definition: defineExtension(() => highlightWhitespace()),
        displayNameKey: 'extensions.highlightWhitespace.name',
        descriptionKey: 'extensions.highlightWhitespace.description'
    },
    [ExtensionKey.ExtensionHighlightTrailingWhitespace]: {
        definition: defineExtension(() => highlightTrailingWhitespace()),
        displayNameKey: 'extensions.highlightTrailingWhitespace.name',
        descriptionKey: 'extensions.highlightTrailingWhitespace.description'
    },
    [ExtensionKey.ExtensionHttpClient]: {
        definition: defineExtension(() => createHttpClientExtension()),
        displayNameKey: 'extensions.httpClient.name',
        descriptionKey: 'extensions.httpClient.description'
    }
};

const isRegisteredExtension = (key: string): key is ValidExtensionKey =>
    Object.prototype.hasOwnProperty.call(EXTENSION_REGISTRY, key);

const getRegistryEntry = (key: string): ExtensionEntry | undefined => {
    if (!isRegisteredExtension(key)) {
        return undefined;
    }
    return EXTENSION_REGISTRY[key];
};

export function registerAllExtensions(manager: Manager): void {
    (Object.entries(EXTENSION_REGISTRY) as [ValidExtensionKey, ExtensionEntry][]).forEach(([id, entry]) => {
        manager.registerExtension(id, entry.definition);
    });
}

export function getExtensionDisplayName(key: string): string {
    const entry = getRegistryEntry(key);
    return entry?.displayNameKey ? i18n.global.t(entry.displayNameKey) : key;
}

export function getExtensionDescription(key: string): string {
    const entry = getRegistryEntry(key);
    return entry?.descriptionKey ? i18n.global.t(entry.descriptionKey) : '';
}

function getExtensionDefinition(key: string): ExtensionDefinition | undefined {
    return getRegistryEntry(key)?.definition;
}

export function getExtensionDefaultConfig(key: string): any {
    const definition = getExtensionDefinition(key);
    if (!definition) return {};
    return cloneConfig(definition.defaultConfig);
}

export function hasExtensionConfig(key: string): boolean {
    return Object.keys(getExtensionDefaultConfig(key)).length > 0;
}

export function getAllExtensionIds(): string[] {
    return Object.keys(EXTENSION_REGISTRY);
}

const cloneConfig = (config: any) => {
    if (Array.isArray(config)) {
        return config.map(cloneConfig);
    }
    if (config && typeof config === 'object') {
        return Object.keys(config).reduce((acc, key) => {
            acc[key] = cloneConfig(config[key]);
            return acc;
        }, {} as Record<string, any>);
    }
    return config;
};
