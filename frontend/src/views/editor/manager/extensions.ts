import {Manager} from './manager';
import {ExtensionID} from '@/../bindings/voidraft/internal/models/models';
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

type ExtensionEntry = {
    definition: ExtensionDefinition
    displayNameKey: string
    descriptionKey: string
};

type RegisteredExtensionID = Exclude<ExtensionID, ExtensionID.$zero | ExtensionID.ExtensionEditor>;

const defineExtension = (create: (config: any) => any, defaultConfig: Record<string, any> = {}): ExtensionDefinition => ({
    create,
    defaultConfig
});

const EXTENSION_REGISTRY: Record<RegisteredExtensionID, ExtensionEntry> = {
    [ExtensionID.ExtensionRainbowBrackets]: {
        definition: defineExtension(() => rainbowBrackets()),
        displayNameKey: 'extensions.rainbowBrackets.name',
        descriptionKey: 'extensions.rainbowBrackets.description'
    },
    [ExtensionID.ExtensionHyperlink]: {
        definition: defineExtension(() => hyperLink),
        displayNameKey: 'extensions.hyperlink.name',
        descriptionKey: 'extensions.hyperlink.description'
    },
    [ExtensionID.ExtensionColorSelector]: {
        definition: defineExtension(() => color),
        displayNameKey: 'extensions.colorSelector.name',
        descriptionKey: 'extensions.colorSelector.description'
    },
    [ExtensionID.ExtensionTranslator]: {
        definition: defineExtension(() => createTranslatorExtension()),
        displayNameKey: 'extensions.translator.name',
        descriptionKey: 'extensions.translator.description'
    },
    [ExtensionID.ExtensionMinimap]: {
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
    [ExtensionID.ExtensionSearch]: {
        definition: defineExtension(() => vscodeSearch),
        displayNameKey: 'extensions.search.name',
        descriptionKey: 'extensions.search.description'
    },
    [ExtensionID.ExtensionFold]: {
        definition: defineExtension(() => Prec.low(foldGutter())),
        displayNameKey: 'extensions.fold.name',
        descriptionKey: 'extensions.fold.description'
    },
    [ExtensionID.ExtensionMarkdown]: {
        definition: defineExtension(() => markdownExtensions),
        displayNameKey: 'extensions.markdown.name',
        descriptionKey: 'extensions.markdown.description'
    },
    [ExtensionID.ExtensionLineNumbers]: {
        definition: defineExtension(() => Prec.high([blockLineNumbers, highlightActiveLineGutter()])),
        displayNameKey: 'extensions.lineNumbers.name',
        descriptionKey: 'extensions.lineNumbers.description'
    },
    [ExtensionID.ExtensionContextMenu]: {
        definition: defineExtension(() => createEditorContextMenu()),
        displayNameKey: 'extensions.contextMenu.name',
        descriptionKey: 'extensions.contextMenu.description'
    },
    [ExtensionID.ExtensionHighlightWhitespace]: {
        definition: defineExtension(() => highlightWhitespace()),
        displayNameKey: 'extensions.highlightWhitespace.name',
        descriptionKey: 'extensions.highlightWhitespace.description'
    },
    [ExtensionID.ExtensionHighlightTrailingWhitespace]: {
        definition: defineExtension(() => highlightTrailingWhitespace()),
        displayNameKey: 'extensions.highlightTrailingWhitespace.name',
        descriptionKey: 'extensions.highlightTrailingWhitespace.description'
    }
} as const;

const isRegisteredExtension = (id: ExtensionID): id is RegisteredExtensionID =>
    Object.prototype.hasOwnProperty.call(EXTENSION_REGISTRY, id);

const getRegistryEntry = (id: ExtensionID): ExtensionEntry | undefined => {
    if (!isRegisteredExtension(id)) {
        return undefined;
    }
    return EXTENSION_REGISTRY[id];
};

export function registerAllExtensions(manager: Manager): void {
    (Object.entries(EXTENSION_REGISTRY) as [RegisteredExtensionID, ExtensionEntry][]).forEach(([id, entry]) => {
        manager.registerExtension(id, entry.definition);
    });
}

export function getExtensionDisplayName(id: ExtensionID): string {
    const entry = getRegistryEntry(id);
    return entry?.displayNameKey ? i18n.global.t(entry.displayNameKey) : id;
}

export function getExtensionDescription(id: ExtensionID): string {
    const entry = getRegistryEntry(id);
    return entry?.descriptionKey ? i18n.global.t(entry.descriptionKey) : '';
}

function getExtensionDefinition(id: ExtensionID): ExtensionDefinition | undefined {
    return getRegistryEntry(id)?.definition;
}

export function getExtensionDefaultConfig(id: ExtensionID): any {
    const definition = getExtensionDefinition(id);
    if (!definition) return {};
    return cloneConfig(definition.defaultConfig);
}

export function hasExtensionConfig(id: ExtensionID): boolean {
    return Object.keys(getExtensionDefaultConfig(id)).length > 0;
}

export function getAllExtensionIds(): ExtensionID[] {
    return Object.keys(EXTENSION_REGISTRY) as RegisteredExtensionID[];
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
