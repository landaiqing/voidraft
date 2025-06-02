<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import { SystemService } from '@/../bindings/voidraft/internal/services';
import type { MemoryStats } from '@/../bindings/voidraft/internal/services';

const memoryStats = ref<MemoryStats | null>(null);
const formattedMemory = ref('');
const isLoading = ref(true);
const canvasRef = ref<HTMLCanvasElement | null>(null);
let intervalId: ReturnType<typeof setInterval> | null = null;

// 存储历史数据点 (最近60个数据点，每3秒一个点，总共3分钟历史)
const historyData = ref<number[]>([]);
const maxDataPoints = 60;

// 获取内存统计信息
const fetchMemoryStats = async () => {
  try {
    const stats = await SystemService.GetMemoryStats();
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
    
    // 添加新数据点到历史记录
    const memoryUsagePercent = Math.min((stats.heapInUse / (100 * 1024 * 1024)) * 100, 100);
    historyData.value.push(memoryUsagePercent);
    
    // 保持最大数据点数量
    if (historyData.value.length > maxDataPoints) {
      historyData.value.shift();
    }
    
    // 更新图表
    drawChart();
    
    isLoading.value = false;
  } catch (error) {
    console.error('Failed to fetch memory stats:', error);
    isLoading.value = false;
  }
};

// 绘制实时曲线图
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
  
  // 绘制背景网格 - 朦胧的网格，从上到下逐渐清晰
  for (let i = 0; i <= 6; i++) {
    const y = (height / 6) * i;
    const opacity = 0.01 + (i / 6) * 0.03; // 从上到下逐渐清晰
    ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  
  // 垂直网格线
  for (let i = 0; i <= 8; i++) {
    const x = (width / 8) * i;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
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
  
  // 绘制填充区域 - 从上朦胧到下清晰的渐变
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, 'rgba(74, 158, 255, 0.1)'); // 顶部很淡
  gradient.addColorStop(0.3, 'rgba(74, 158, 255, 0.15)');
  gradient.addColorStop(0.7, 'rgba(74, 158, 255, 0.25)');
  gradient.addColorStop(1, 'rgba(74, 158, 255, 0.4)'); // 底部较浓
  
  ctx.beginPath();
  ctx.moveTo(startX, height);
  
  // 移动到第一个数据点
  const firstY = height - (historyData.value[0] / 100) * height;
  ctx.lineTo(startX, firstY);
  
  // 使用二次贝塞尔曲线平滑曲线
  for (let i = 1; i < dataLength; i++) {
    const x = startX + i * stepX;
    const y = height - (historyData.value[i] / 100) * height;
    
    if (i < dataLength - 1) {
      const nextX = startX + (i + 1) * stepX;
      const nextY = height - (historyData.value[i + 1] / 100) * height;
      const controlX = x + stepX / 2;
      const controlY = y;
      ctx.quadraticCurveTo(controlX, controlY, (x + nextX) / 2, (y + nextY) / 2);
    } else {
      ctx.lineTo(x, y);
    }
  }
  
  // 完成填充路径
  const lastX = startX + (dataLength - 1) * stepX;
  ctx.lineTo(lastX, height);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();
  
  // 绘制主曲线 - 从上到下逐渐清晰
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  // 分段绘制曲线，每段有不同的透明度
  const segments = 10;
  for (let seg = 0; seg < segments; seg++) {
    const segmentStart = seg / segments;
    const segmentEnd = (seg + 1) / segments;
    const opacity = 0.3 + (seg / segments) * 0.7; // 从上0.3到下1.0
    
    ctx.strokeStyle = `rgba(74, 158, 255, ${opacity})`;
    ctx.lineWidth = 1.5 + (seg / segments) * 0.8; // 线条也从细到粗
    
    ctx.beginPath();
    let segmentStarted = false;
    
    for (let i = 0; i < dataLength; i++) {
      const x = startX + i * stepX;
      const y = height - (historyData.value[i] / 100) * height;
      const yPercent = 1 - (y / height);
      
      if (yPercent >= segmentStart && yPercent <= segmentEnd) {
        if (!segmentStarted) {
          ctx.moveTo(x, y);
          segmentStarted = true;
        } else {
          if (i < dataLength - 1) {
            const nextX = startX + (i + 1) * stepX;
            const nextY = height - (historyData.value[i + 1] / 100) * height;
            const controlX = x + stepX / 2;
            const controlY = y;
            ctx.quadraticCurveTo(controlX, controlY, (x + nextX) / 2, (y + nextY) / 2);
          } else {
            ctx.lineTo(x, y);
          }
        }
      }
    }
    
    if (segmentStarted) {
      ctx.stroke();
    }
  }
  
  // 绘制当前值的高亮点 - 根据位置调整透明度
  const lastY = height - (historyData.value[dataLength - 1] / 100) * height;
  const pointOpacity = 0.4 + (1 - lastY / height) * 0.6;
  
  // 外圈
  ctx.fillStyle = `rgba(74, 158, 255, ${pointOpacity * 0.3})`;
  ctx.beginPath();
  ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
  ctx.fill();
  
  // 内圈
  ctx.fillStyle = `rgba(74, 158, 255, ${pointOpacity})`;
  ctx.beginPath();
  ctx.arc(lastX, lastY, 2, 0, Math.PI * 2);
  ctx.fill();
};

// 手动触发GC
const triggerGC = async () => {
  try {
    await SystemService.TriggerGC();
    // 延迟一下再获取新的统计信息
    setTimeout(fetchMemoryStats, 100);
  } catch (error) {
    console.error('Failed to trigger GC:', error);
  }
};

// 处理窗口大小变化
const handleResize = () => {
  if (historyData.value.length > 0) {
    nextTick(() => drawChart());
  }
};

onMounted(() => {
  fetchMemoryStats();
  // 每3秒更新一次内存信息
  intervalId = setInterval(fetchMemoryStats, 3000);
  
  // 监听窗口大小变化
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  if (intervalId) {
    clearInterval(intervalId);
  }
  window.removeEventListener('resize', handleResize);
});
</script>

<template>
  <div class="memory-monitor" @click="triggerGC" :title="`内存: ${formattedMemory} | 点击清理内存`">
    <div class="monitor-info">
      <div class="memory-label">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
        </svg>
        <span>内存</span>
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
        color: #4a9eff;
      }
      
      .memory-value {
        color: #ffffff;
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
      color: #a0a0a0;
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
      color: #e0e0e0;
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