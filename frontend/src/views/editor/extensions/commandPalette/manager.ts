import { readonly, shallowRef, type ShallowRef } from "vue";

interface CommandPaletteState {
    visible: boolean;
    initialQuery: string;
}

class CommandPaletteManager {
    private state: ShallowRef<CommandPaletteState> = shallowRef({
        visible: false,
        initialQuery: "",
    });

    useState() {
        return readonly(this.state);
    }

    show(initialQuery = ""): void {
        this.state.value = {
            visible: true,
            initialQuery,
        };
    }

    hide(): void {
        this.state.value = {
            visible: false,
            initialQuery: "",
        };
    }

    toggle(initialQuery = ""): void {
        if (this.state.value.visible) {
            this.hide();
            return;
        }

        this.show(initialQuery);
    }

    destroy(): void {
        this.hide();
    }
}

export const commandPaletteManager = new CommandPaletteManager();
