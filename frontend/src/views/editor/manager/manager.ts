import {Compartment, Extension} from '@codemirror/state';
import {EditorView} from '@codemirror/view';
import {Extension as ExtensionConfig, ExtensionID} from '@/../bindings/voidraft/internal/models/models';
import {ExtensionDefinition, ExtensionState} from './types';

/**
 * 扩展管理器
 * 负责注册、初始化与同步所有动态扩展
 */
export class Manager {
    private extensionStates = new Map<ExtensionID, ExtensionState>();
    private views = new Map<number, EditorView>();

    registerExtension(id: ExtensionID, definition: ExtensionDefinition): void {
        const existingState = this.extensionStates.get(id);
        if (existingState) {
            existingState.definition = definition;
            if (existingState.config === undefined) {
                existingState.config = this.cloneConfig(definition.defaultConfig ?? {});
            }
        } else {
            const compartment = new Compartment();
            const defaultConfig = this.cloneConfig(definition.defaultConfig ?? {});
            this.extensionStates.set(id, {
                id,
                definition,
                config: defaultConfig,
                enabled: false,
                compartment,
                extension: []
            });
        }
    }

    initExtensions(extensionConfigs: ExtensionConfig[]): void {
        for (const config of extensionConfigs) {
            const state = this.extensionStates.get(config.id);
            if (!state) continue;
            const resolvedConfig = this.cloneConfig(config.config ?? state.definition.defaultConfig ?? {});
            this.commitExtensionState(state, config.enabled, resolvedConfig);
        }
    }

    getInitialExtensions(): Extension[] {
        const extensions: Extension[] = [];
        for (const state of this.extensionStates.values()) {
            extensions.push(state.compartment.of(state.extension));
        }
        return extensions;
    }

    setView(view: EditorView, documentId: number): void {
        this.views.set(documentId, view);
        this.applyAllExtensionsToView(view);
    }

    updateExtension(id: ExtensionID, enabled: boolean, config?: any): void {
        const state = this.extensionStates.get(id);
        if (!state) return;

        const resolvedConfig = this.resolveConfig(state, config);
        this.commitExtensionState(state, enabled, resolvedConfig);
    }

    removeView(documentId: number): void {
        this.views.delete(documentId);
    }

    destroy(): void {
        this.views.clear();
        this.extensionStates.clear();
    }

    private resolveConfig(state: ExtensionState, config?: any): any {
        if (config !== undefined) {
            return this.cloneConfig(config);
        }
        if (state.config !== undefined) {
            return this.cloneConfig(state.config);
        }
        return this.cloneConfig(state.definition.defaultConfig ?? {});
    }

    private commitExtensionState(state: ExtensionState, enabled: boolean, config: any): void {
        try {
            const runtimeExtension = enabled ? state.definition.create(config) : [];
            state.enabled = enabled;
            state.config = config;
            state.extension = runtimeExtension;
            this.applyExtensionToAllViews(state.id);
        } catch (error) {
            console.error(`Failed to update extension ${state.id}:`, error);
        }
    }

    private applyExtensionToAllViews(id: ExtensionID): void {
        const state = this.extensionStates.get(id);
        if (!state) return;

        for (const [documentId, view] of this.views.entries()) {
            try {
                view.dispatch({effects: state.compartment.reconfigure(state.extension)});
            } catch (error) {
                console.error(`Failed to apply extension ${id} to document ${documentId}:`, error);
            }
        }
    }

    private applyAllExtensionsToView(view: EditorView): void {
        const effects: any[] = [];
        for (const state of this.extensionStates.values()) {
            effects.push(state.compartment.reconfigure(state.extension));
        }
        if (effects.length === 0) return;

        try {
            view.dispatch({effects});
        } catch (error) {
            console.error('Failed to register extensions on view:', error);
        }
    }

    private cloneConfig<T>(config: T): T {
        if (Array.isArray(config)) {
            return config.map(item => this.cloneConfig(item)) as unknown as T;
        }
        if (config && typeof config === 'object') {
            return Object.keys(config as Record<string, any>).reduce((acc, key) => {
                (acc as any)[key] = this.cloneConfig((config as Record<string, any>)[key]);
                return acc;
            }, {} as Record<string, any>) as T;
        }
        return config;
    }
}
