<script setup lang="ts">
import {computed, nextTick, onMounted, onUnmounted, ref, watch} from 'vue';
import type {MemoryStats} from '@/../bindings/voidraft/internal/services';
import {SystemService} from '@/../bindings/voidraft/internal/services';
import {useI18n} from 'vue-i18n';
import {useThemeStore} from '@/stores/themeStore';
import {SystemThemeType} from '@/../bindings/voidraft/internal/models/models';

const {t} = useI18n();
const themeStore = useThemeStore();

// 响应式状态
const memoryStats = ref<MemoryStats | null>(null);
const formattedMemory = ref('');
const isLoading = ref(true);
const canvasRef = ref<HTMLCanvasElement | null>(null);

// 存储历史数据点 (最近60个数据点)
const historyData = ref<number[]>([]);
const maxDataPoints = 60;

// 动态最大内存值（MB），初始为200MB，会根据实际使用动态调整
const maxMemoryMB = ref(200);

let intervalId: ReturnType<typeof setInterval> | null = null;

// 使用 computed 获取当前主题状态
const isDarkTheme = computed(() => {
  const {currentTheme} = themeStore;
  return currentTheme === SystemThemeType.SystemThemeDark;
});

// 监听主题变化，重新绘制图表
watch(() => themeStore.currentTheme, () => {
  nextTick(drawChart);
});

// 格式化内存显示函数
const formatMemorySize = (heapMB: number): string => {
  if (heapMB < 1) return `${(heapMB * 1024).toFixed(0)}K`;
  if (heapMB < 100) return `${heapMB.toFixed(1)}M`;
  return `${heapMB.toFixed(0)}M`;
};

// 获取内存统计信息
const fetchMemoryStats = async (): Promise<void> => {
  try {
    const stats = await SystemService.GetMemoryStats();

    memoryStats.value = stats;

    // 格式化内存显示 - 主要显示堆内存使用量
    const heapMB = stats.heapInUse / (1024 * 1024);
    formattedMemory.value = formatMemorySize(heapMB);

    // 自动调整最大内存值，确保图表能够显示更大范围
    if (heapMB > maxMemoryMB.value * 0.8) {
      maxMemoryMB.value = Math.ceil(heapMB * 2);
    }

    // 添加新数据点到历史记录 - 使用动态最大值计算百分比
    const memoryUsagePercent = Math.min((heapMB / maxMemoryMB.value) * 100, 100);
    historyData.value = [...historyData.value, memoryUsagePercent].slice(-maxDataPoints);

    // 更新图表
    drawChart();
  } catch {
    // 静默处理错误
  } finally {
    isLoading.value = false;
  }
};

// 获取主题相关颜色配置
const getThemeColors = () => {
  const isDark = isDarkTheme.value;
  return {
    grid: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.07)',
    line: isDark ? 'rgba(74, 158, 255, 0.6)' : 'rgba(37, 99, 235, 0.6)',
    fill: isDark ? 'rgba(74, 158, 255, 0.05)' : 'rgba(37, 99, 235, 0.05)',
    point: isDark ? 'rgba(74, 158, 255, 0.8)' : 'rgba(37, 99, 235, 0.8)'
  };
};

// 绘制网格背景
const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number, colors: ReturnType<typeof getThemeColors>): void => {
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 0.5;

  // 水平网格线
  for (let i = 0; i <= 4; i++) {
    const y = (height / 4) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // 垂直网格线
  for (let i = 0; i <= 6; i++) {
    const x = (width / 6) * i;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
};

// 绘制平滑曲线路径
const drawSmoothPath = (
    ctx: CanvasRenderingContext2D,
    data: number[],
    startX: number,
    stepX: number,
    height: number,
    fillArea = false
): void => {
  if (data.length < 2) return;

  const firstY = height - (data[0] / 100) * height;

  ctx.beginPath();
  if (fillArea) ctx.moveTo(startX, height);
  ctx.moveTo(startX, firstY);

  // 使用二次贝塞尔曲线绘制平滑路径
  for (let i = 1; i < data.length; i++) {
    const x = startX + i * stepX;
    const y = height - (data[i] / 100) * height;

    if (i === 1) {
      ctx.lineTo(x, y);
    } else {
      const prevX = startX + (i - 1) * stepX;
      const prevY = height - (data[i - 1] / 100) * height;
      const cpX = (prevX + x) / 2;
      const cpY = (prevY + y) / 2;
      ctx.quadraticCurveTo(cpX, cpY, x, y);
    }
  }

  if (fillArea) {
    const lastX = startX + (data.length - 1) * stepX;
    ctx.lineTo(lastX, height);
    ctx.closePath();
  }
};

// 绘制实时曲线图
const drawChart = (): void => {
  const canvas = canvasRef.value;
  if (!canvas || historyData.value.length === 0) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // 设置canvas尺寸
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio;

  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const {width, height} = rect;

  // 清除画布
  ctx.clearRect(0, 0, width, height);

  // 获取主题颜色
  const colors = getThemeColors();

  // 绘制背景网格
  drawGrid(ctx, width, height, colors);

  if (historyData.value.length < 2) return;

  // 计算数据点位置
  const dataLength = historyData.value.length;
  const stepX = width / (maxDataPoints - 1);
  const startX = width - (dataLength - 1) * stepX;

  // 绘制填充区域
  drawSmoothPath(ctx, historyData.value, startX, stepX, height, true);
  ctx.fillStyle = colors.fill;
  ctx.fill();

  // 绘制主曲线
  drawSmoothPath(ctx, historyData.value, startX, stepX, height);
  ctx.strokeStyle = colors.line;
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();

  // 绘制当前值的高亮点
  const lastX = startX + (dataLength - 1) * stepX;
  const lastY = height - (historyData.value[dataLength - 1] / 100) * height;

  // 外圈
  ctx.fillStyle = colors.point;
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
  ctx.fill();

  // 内圈
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(lastX, lastY, 1.5, 0, Math.PI * 2);
  ctx.fill();
};

// 手动触发GC
const triggerGC = async (): Promise<void> => {
  try {
    await SystemService.TriggerGC();
  } catch (error) {
    console.error("Failed to trigger GC: ", error);
  }
};

onMounted(() => {
  fetchMemoryStats();
  // 每3秒更新一次内存信息
  intervalId = setInterval(fetchMemoryStats, 3000);
});

onUnmounted(() => {
  intervalId && clearInterval(intervalId);
});
</script>

<template>
  <div class="memory-monitor" @click="triggerGC"
       :title="`${t('monitor.memory')}: ${formattedMemory} | ${t('monitor.clickToClean')}`">
    <div class="monitor-info">
      <div class="memory-label">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
        </svg>
        <span>{{ t('monitor.memory') }}</span>
      </div>
      <div class="memory-value" v-if="!isLoading">{{ formattedMemory }}</div>
      <div class="memory-loading" v-else>--</div>
    </div>
    <div class="chart-area">
      <canvas
          ref="canvasRef"
          class="memory-chart"
          :class="{ 'loading': isLoading }"
      ></canvas>
    </div>
  </div>
</template>

<style scoped lang="scss">
.memory-monitor {
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  width: 100%;

  &:hover {
    .monitor-info {
      .memory-label {
        color: var(--selection-text);
      }

      .memory-value {
        color: var(--toolbar-text);
      }
    }

    .chart-area .memory-chart {
      opacity: 1;
    }
  }

  .monitor-info {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .memory-label {
      display: flex;
      align-items: center;
      gap: 4px;
      color: var(--text-secondary);
      font-size: 10px;
      font-weight: 500;
      transition: color 0.2s ease;

      svg {
        width: 10px;
        height: 10px;
        opacity: 0.8;
      }

      span {
        user-select: none;
      }
    }

    .memory-value, .memory-loading {
      color: var(--toolbar-text-secondary);
      font-family: 'JetBrains Mono', 'Courier New', monospace;
      font-size: 9px;
      font-weight: 600;
      transition: color 0.2s ease;
    }

    .memory-loading {
      opacity: 0.5;
      animation: pulse 1.5s ease-in-out infinite;
    }
  }

  .chart-area {
    height: 48px;
    position: relative;
    overflow: hidden;
    border-radius: 3px;

    .memory-chart {
      width: 100%;
      height: 100%;
      display: block;
      opacity: 0.9;
      transition: opacity 0.2s ease;

      &.loading {
        opacity: 0.3;
      }
    }
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 0.5;
  }
  50% {
    opacity: 0.8;
  }
}
</style>