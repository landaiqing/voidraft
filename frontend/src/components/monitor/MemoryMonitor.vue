<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed, watch } from 'vue';
import { SystemService } from '@/../bindings/voidraft/internal/services';
import type { MemoryStats } from '@/../bindings/voidraft/internal/services';
import { useI18n } from 'vue-i18n';
import { useThemeStore } from '@/stores/themeStore';
import { SystemThemeType } from '@/../bindings/voidraft/internal/models/models';

const { t } = useI18n();
const themeStore = useThemeStore();
const memoryStats = ref<MemoryStats | null>(null);
const formattedMemory = ref('');
const isLoading = ref(true);
const canvasRef = ref<HTMLCanvasElement | null>(null);
let intervalId: ReturnType<typeof setInterval> | null = null;

// 存储历史数据点 (最近60个数据点)
const historyData = ref<number[]>([]);
const maxDataPoints = 60;

// 动态最大内存值（MB），初始为200MB，会根据实际使用动态调整
const maxMemoryMB = ref(200);

// 使用themeStore获取当前主题
const isDarkTheme = computed(() => {
  const theme = themeStore.currentTheme;
  if (theme === SystemThemeType.SystemThemeAuto) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return theme === SystemThemeType.SystemThemeDark;
});

// 监听主题变化，重新绘制图表
watch(() => themeStore.currentTheme, () => {
  nextTick(() => drawChart());
});

// 静默错误处理包装器
const withSilentErrorHandling = async <T>(
  operation: () => Promise<T>,
  fallback?: T
): Promise<T | undefined> => {
  try {
    return await operation();
  } catch (error) {
    // 静默处理错误，不输出到控制台
    return fallback;
  }
};

// 获取内存统计信息
const fetchMemoryStats = async () => {
  const stats = await withSilentErrorHandling(() => SystemService.GetMemoryStats());
  
  if (!stats) {
    isLoading.value = false;
    return;
  }
  
    memoryStats.value = stats;
    
    // 格式化内存显示 - 主要显示堆内存使用量
    const heapMB = (stats.heapInUse / 1024 / 1024);
    if (heapMB < 1) {
      formattedMemory.value = `${(heapMB * 1024).toFixed(0)}K`;
    } else if (heapMB < 100) {
      formattedMemory.value = `${heapMB.toFixed(1)}M`;
    } else {
      formattedMemory.value = `${heapMB.toFixed(0)}M`;
    }
    
    // 自动调整最大内存值，确保图表能够显示更大范围
    if (heapMB > maxMemoryMB.value * 0.8) {
      // 如果内存使用超过当前最大值的80%，则将最大值调整为当前使用值的2倍
      maxMemoryMB.value = Math.ceil(heapMB * 2);
    }
    
    // 添加新数据点到历史记录 - 使用动态最大值计算百分比
    const memoryUsagePercent = Math.min((heapMB / maxMemoryMB.value) * 100, 100);
    historyData.value.push(memoryUsagePercent);
    
    // 保持最大数据点数量
    if (historyData.value.length > maxDataPoints) {
      historyData.value.shift();
    }
    
    // 更新图表
    drawChart();
    
    isLoading.value = false;
};

// 绘制实时曲线图 - 简化版
const drawChart = () => {
  if (!canvasRef.value || historyData.value.length === 0) return;
  
  const canvas = canvasRef.value;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  // 设置canvas尺寸
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * window.devicePixelRatio;
  canvas.height = rect.height * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  
  const width = rect.width;
  const height = rect.height;
  
  // 清除画布
  ctx.clearRect(0, 0, width, height);
  
  // 根据主题选择合适的颜色 - 更柔和的颜色
  const gridColor = isDarkTheme.value ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.07)';
  const lineColor = isDarkTheme.value ? 'rgba(74, 158, 255, 0.6)' : 'rgba(37, 99, 235, 0.6)';
  const fillColor = isDarkTheme.value ? 'rgba(74, 158, 255, 0.05)' : 'rgba(37, 99, 235, 0.05)';
  const pointColor = isDarkTheme.value ? 'rgba(74, 158, 255, 0.8)' : 'rgba(37, 99, 235, 0.8)';
  
  // 绘制背景网格 - 更加柔和
  for (let i = 0; i <= 4; i++) {
    const y = (height / 4) * i;
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  
  // 垂直网格线
  for (let i = 0; i <= 6; i++) {
    const x = (width / 6) * i;
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  
  if (historyData.value.length < 2) return;
  
  // 计算数据点位置
  const dataLength = historyData.value.length;
  const stepX = width / (maxDataPoints - 1);
  const startX = width - (dataLength - 1) * stepX;
  
  // 绘制填充区域 - 更柔和的填充
  ctx.beginPath();
  ctx.moveTo(startX, height);
  
  // 移动到第一个数据点
  const firstY = height - (historyData.value[0] / 100) * height;
  ctx.lineTo(startX, firstY);
  
  // 绘制数据点路径 - 使用曲线连接点，确保连续性
  for (let i = 1; i < dataLength; i++) {
    const x = startX + i * stepX;
    const y = height - (historyData.value[i] / 100) * height;
    
    // 使用贝塞尔曲线平滑连接
    if (i < dataLength - 1) {
      const nextX = startX + (i + 1) * stepX;
      const nextY = height - (historyData.value[i + 1] / 100) * height;
      const cpX1 = x - stepX / 4;
      const cpY1 = y;
      const cpX2 = x + stepX / 4;
      const cpY2 = nextY;
      
      // 使用三次贝塞尔曲线平滑连接点
      ctx.bezierCurveTo(cpX1, cpY1, cpX2, cpY2, nextX, nextY);
      i++; // 跳过下一个点，因为已经在曲线中处理了
    } else {
      ctx.lineTo(x, y);
    }
  }
  
  // 完成填充路径
  const lastX = startX + (dataLength - 1) * stepX;
  ctx.lineTo(lastX, height);
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();
  
  // 绘制主曲线 - 平滑连续的曲线
  ctx.beginPath();
  ctx.moveTo(startX, firstY);
  
  // 重新绘制曲线路径，但这次只绘制线条
  for (let i = 1; i < dataLength; i++) {
    const x = startX + i * stepX;
    const y = height - (historyData.value[i] / 100) * height;
    
    // 使用贝塞尔曲线平滑连接
    if (i < dataLength - 1) {
      const nextX = startX + (i + 1) * stepX;
      const nextY = height - (historyData.value[i + 1] / 100) * height;
      const cpX1 = x - stepX / 4;
      const cpY1 = y;
      const cpX2 = x + stepX / 4;
      const cpY2 = nextY;
      
      // 使用三次贝塞尔曲线平滑连接点
      ctx.bezierCurveTo(cpX1, cpY1, cpX2, cpY2, nextX, nextY);
      i++; // 跳过下一个点，因为已经在曲线中处理了
    } else {
      ctx.lineTo(x, y);
    }
  }
  
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
  
  // 绘制当前值的高亮点
  const lastY = height - (historyData.value[dataLength - 1] / 100) * height;
  
  // 外圈
  ctx.fillStyle = pointColor;
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
const triggerGC = async () => {
  const success = await withSilentErrorHandling(() => SystemService.TriggerGC());
  
  if (success) {
    // 延迟一下再获取新的统计信息
    setTimeout(fetchMemoryStats, 100);
  }
};

// 处理窗口大小变化
const handleResize = () => {
  if (historyData.value.length > 0) {
    nextTick(() => drawChart());
  }
};

// 仅监听系统主题变化
const setupSystemThemeListener = () => {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handleSystemThemeChange = () => {
    // 仅当设置为auto时才响应系统主题变化
    if (themeStore.currentTheme === SystemThemeType.SystemThemeAuto) {
      nextTick(() => drawChart());
    }
  };

  // 添加监听器
  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', handleSystemThemeChange);
  }

  // 返回清理函数
  return () => {
    if (mediaQuery.removeEventListener) {
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    }
  };
};

onMounted(() => {
  fetchMemoryStats();
  // 每1秒更新一次内存信息
  intervalId = setInterval(fetchMemoryStats, 3000);
  
  // 监听窗口大小变化
  window.addEventListener('resize', handleResize);
  
  // 设置系统主题监听器（仅用于auto模式）
  const cleanupThemeListener = setupSystemThemeListener();
  
  // 在卸载时清理
  onUnmounted(() => {
    if (intervalId) {
      clearInterval(intervalId);
    }
    window.removeEventListener('resize', handleResize);
    cleanupThemeListener();
  });
});
</script>

<template>
  <div class="memory-monitor" @click="triggerGC" :title="`${t('monitor.memory')}: ${formattedMemory} | ${t('monitor.clickToClean')}`">
    <div class="monitor-info">
      <div class="memory-label">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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