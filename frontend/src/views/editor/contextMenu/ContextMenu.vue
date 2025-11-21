<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { contextMenuManager } from './manager';
import type { RenderMenuItem } from './menuSchema';

const props = defineProps<{
  portalTarget?: HTMLElement | null;
}>();

const menuState = contextMenuManager.useState();
const menuRef = ref<HTMLDivElement | null>(null);
const adjustedPosition = ref({ x: 0, y: 0 });

const isVisible = computed(() => menuState.value.visible);
const items = computed(() => menuState.value.items);
const position = computed(() => menuState.value.position);
const teleportTarget = computed<HTMLElement | string>(() => props.portalTarget ?? 'body');

watch(
  position,
  (newPosition) => {
    adjustedPosition.value = { ...newPosition };
    if (isVisible.value) {
      nextTick(adjustMenuWithinViewport);
    }
  },
  { deep: true }
);

watch(isVisible, (visible) => {
  if (visible) {
    nextTick(adjustMenuWithinViewport);
  }
});

const menuStyle = computed(() => ({
  left: `${adjustedPosition.value.x}px`,
  top: `${adjustedPosition.value.y}px`
}));

async function adjustMenuWithinViewport() {
  await nextTick();
  const menuEl = menuRef.value;
  if (!menuEl) return;

  const rect = menuEl.getBoundingClientRect();
  let nextX = adjustedPosition.value.x;
  let nextY = adjustedPosition.value.y;

  if (rect.right > window.innerWidth) {
    nextX = Math.max(0, window.innerWidth - rect.width - 8);
  }

  if (rect.bottom > window.innerHeight) {
    nextY = Math.max(0, window.innerHeight - rect.height - 8);
  }

  adjustedPosition.value = { x: nextX, y: nextY };
}

function handleItemClick(item: RenderMenuItem) {
  if (item.type !== "action" || item.disabled) {
    return;
  }
  contextMenuManager.runCommand(item);
}

function handleOverlayMouseDown() {
  contextMenuManager.hide();
}

function stopPropagation(event: MouseEvent) {
  event.stopPropagation();
}
</script>

<template>
  <Teleport :to="teleportTarget">
    <template v-if="isVisible">
      <div class="cm-context-overlay" @mousedown="handleOverlayMouseDown" />
      <div
        ref="menuRef"
        class="cm-context-menu show"
        :style="menuStyle"
        role="menu"
        @contextmenu.prevent
        @mousedown="stopPropagation"
      >
        <template v-for="item in items" :key="item.id">
          <div v-if="item.type === 'separator'" class="cm-context-menu-divider" />
          <div
            v-else
            class="cm-context-menu-item"
            :class="{ 'is-disabled': item.disabled }"
            role="menuitem"
            :aria-disabled="item.disabled ? 'true' : 'false'"
            @click="handleItemClick(item)"
          >
            <div class="cm-context-menu-item-label">
              <span>{{ item.label }}</span>
            </div>
            <span v-if="item.shortcut" class="cm-context-menu-item-shortcut">
              {{ item.shortcut }}
            </span>
          </div>
        </template>
      </div>
    </template>
  </Teleport>
</template>

<style scoped lang="scss">
.cm-context-overlay {
  position: absolute;
  inset: 0;
  z-index: 9000;
  background: transparent;
}

.cm-context-menu {
  position: fixed;
  min-width: 180px;
  max-width: 320px;
  padding: 4px 0;
  border-radius: 3px;
  background-color: var(--settings-card-bg, #1c1c1e);
  color: var(--settings-text, #f6f6f6);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
  z-index: 10000;
  opacity: 0;
  transform: scale(0.96);
  transform-origin: top left;
  transition: opacity 0.12s ease, transform 0.12s ease;
}

.cm-context-menu.show {
  opacity: 1;
  transform: scale(1);
}

.cm-context-menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.12s ease, color 0.12s ease;
  white-space: nowrap;
}

.cm-context-menu-item:hover {
  background-color: var(--toolbar-button-hover);
  color: var(--toolbar-text, #ffffff);
}

.cm-context-menu-item.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cm-context-menu-item-label {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cm-context-menu-item-shortcut {
  font-size: 12px;
  opacity: 0.65;
}

.cm-context-menu-divider {
  height: 1px;
  margin: 4px 0;
  border: none;
  background-color: rgba(255, 255, 255, 0.08);
}

</style>
