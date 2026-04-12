import type { KeyBinding } from "@/../bindings/voidraft/internal/models/ent/models";
import { useKeybindingStore } from "@/stores/keybindingStore";
import { useSystemStore } from "@/stores/systemStore";

function getPlatformBindingValue(binding: KeyBinding, os: "mac" | "windows" | "linux"): string {
    if (os === "mac") {
        return binding.macos || binding.key || "";
    }

    if (os === "linux") {
        return binding.linux || binding.key || "";
    }

    return binding.windows || binding.key || "";
}

export function formatKeyBindingLabel(keyBinding: string, isMacOS: boolean): string {
    return keyBinding
        .replace(/Mod/g, isMacOS ? "Cmd" : "Ctrl")
        .replace(/Alt/g, isMacOS ? "Option" : "Alt")
        .replace(/-/g, " + ");
}

export function getCommandKeyBindingLabels(commandName: string): string[] {
    const keybindingStore = useKeybindingStore();
    const systemStore = useSystemStore();
    const os = systemStore.isMacOS ? "mac" : systemStore.isLinux ? "linux" : "windows";
    const bindings = keybindingStore.keyBindings
        .filter(binding => binding.name === commandName && binding.enabled)
        .map(binding => getPlatformBindingValue(binding, os))
        .filter((binding): binding is string => Boolean(binding));

    return Array.from(new Set(bindings.map(binding => formatKeyBindingLabel(binding, systemStore.isMacOS))));
}
