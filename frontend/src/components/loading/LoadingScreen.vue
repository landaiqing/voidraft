<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';

const props = defineProps({
  text: {
    type: String,
    default: 'LOADING'
  }
});

const characters = ref<HTMLSpanElement[]>([]);
const isDone = ref(false);
const cycleCount = 5;
const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890!@#$%^&*()-_=+{}|[]\\;\':"<>?,./`~'.split('');
let animationFrameId: number | null = null;
let resetTimeoutId: number | null = null;

// 将字符串拆分为单个字符的span
function letterize() {
  const container = document.querySelector('.loading-word');
  if (!container) return;
  
  // 清除现有内容
  container.innerHTML = '';
  
  // 为每个字符创建span
  for (let i = 0; i < props.text.length; i++) {
    const span = document.createElement('span');
    span.setAttribute('data-orig', props.text[i]);
    span.textContent = '-';
    span.className = `char${i+1}`;
    container.appendChild(span);
  }
  
  // 获取所有span元素
  characters.value = Array.from(container.querySelectorAll('span'));
}

// 获取随机字符
function getRandomChar() {
  return chars[Math.floor(Math.random() * chars.length)];
}

// 动画循环
function animationLoop() {
  let currentCycle = 0;
  let currentLetterIndex = 0;
  let isAnimationDone = false;
  
  function loop() {
    // 为未完成的字符设置随机字符和不透明度
    for (let i = currentLetterIndex; i < characters.value.length; i++) {
      const char = characters.value[i];
      if (!char.classList.contains('done')) {
        char.textContent = getRandomChar();
        char.style.opacity = Math.random().toString();
      }
    }
    
    if (currentCycle < cycleCount) {
      // 继续当前周期
      currentCycle++;
    } else if (currentLetterIndex < characters.value.length) {
      // 当前周期结束，显示下一个字符的原始值
      const currentChar = characters.value[currentLetterIndex];
      currentChar.textContent = currentChar.getAttribute('data-orig') || '';
      currentChar.style.opacity = '1';
      currentChar.classList.add('done');
      currentLetterIndex++;
      currentCycle = 0;
    } else {
      // 所有字符都已显示
      isAnimationDone = true;
      isDone.value = true;
    }
    
    if (!isAnimationDone) {
      animationFrameId = requestAnimationFrame(loop);
    } else {
      // 等待一段时间后重置动画
      resetTimeoutId = window.setTimeout(() => {
        reset();
      }, 500);
    }
  }
  
  loop();
}

// 重置动画
function reset() {
  isDone.value = false;
  
  for (const char of characters.value) {
    char.textContent = char.getAttribute('data-orig') || '';
    char.classList.remove('done');
  }
  
  animationLoop();
}

// 清理所有定时器
function cleanup() {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  
  if (resetTimeoutId !== null) {
    clearTimeout(resetTimeoutId);
    resetTimeoutId = null;
  }
}

onMounted(() => {
  letterize();
  animationLoop();
});

onBeforeUnmount(() => {
  cleanup();
});
</script>

<template>
  <div class="loading-screen">
    <div class="loading-word"></div>
    <div class="overlay"></div>
  </div>
</template>

<style scoped lang="scss">
.loading-screen {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  //background: var(--voidraft-bg-gradient, rgba(0, 5, 0, 0.15));
  //backdrop-filter: blur(2px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--voidraft-mono-font, monospace),serif;
}

.loading-word {
  color: var(--voidraft-loading-color, #fff);
  font-size: 2.5em;
  height: 2.5em;
  line-height: 2.5em;
  text-align: center;
  text-shadow: var(--voidraft-loading-glow, 0 0 10px rgba(50, 255, 50, 0.5), 0 0 5px rgba(100, 255, 100, 0.5));
}

.loading-word span {
  display: inline-block;
  transform: translateX(100%) scale(0.9);
  transition: transform 500ms;
}

.loading-word .done {
  color: var(--voidraft-loading-done-color, #6f6);
  transform: translateX(0) scale(1);
}

.overlay {
  background-image: var(--voidraft-loading-overlay, linear-gradient(transparent 0%, rgba(10, 16, 10, 0.5) 50%));
  background-size: 1000px 2px;
  bottom: 0;
  left: 0;
  position: absolute;
  right: 0;
  top: 0;
  pointer-events: none;
}
</style> 