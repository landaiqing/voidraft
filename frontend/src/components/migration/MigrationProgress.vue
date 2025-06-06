<template>
  <div v-if="visible" class="migration-overlay">
    <div class="migration-modal">
      <div class="migration-header">
        <h3>{{ t('migration.title') }}</h3>
        <div class="migration-status" :class="status">
          {{ getStatusText() }}
        </div>
      </div>
      
      <div class="migration-content">
        <div class="progress-container">
          <div class="progress-bar">
            <div 
              class="progress-fill" 
              :style="{ width: `${progress.progress || 0}%` }"
              :class="status"
            ></div>
          </div>
          <div class="progress-text">
            {{ Math.round(progress.progress || 0) }}%
          </div>
        </div>
        
        <div class="migration-details">
          <div v-if="progress.message" class="message">
            {{ progress.message }}
          </div>
          
          <div v-if="progress.currentFile" class="current-file">
            <span class="label">{{ t('migration.currentFile') }}:</span>
            <span class="file-name">{{ progress.currentFile }}</span>
          </div>
          
          <div class="stats" v-if="progress.totalFiles > 0">
            <div class="stat-item">
              <span class="label">{{ t('migration.files') }}:</span>
              <span class="value">{{ progress.processedFiles }} / {{ progress.totalFiles }}</span>
            </div>
            
            <div class="stat-item" v-if="progress.totalBytes > 0">
              <span class="label">{{ t('migration.size') }}:</span>
              <span class="value">{{ formatBytes(progress.processedBytes) }} / {{ formatBytes(progress.totalBytes) }}</span>
            </div>
            
            <div class="stat-item" v-if="progress.estimatedTime && status === 'migrating'">
              <span class="label">{{ t('migration.timeRemaining') }}:</span>
              <span class="value">{{ formatDuration(progress.estimatedTime) }}</span>
            </div>
          </div>
          
          <div v-if="progress.error" class="error-message">
            <span class="error-icon">⚠️</span>
            {{ progress.error }}
          </div>
        </div>
      </div>
      
      <div class="migration-actions">
        <button 
          v-if="status === 'completed'" 
          @click="handleComplete"
          class="action-button success"
        >
          {{ t('migration.complete') }}
        </button>
        
        <button 
          v-if="status === 'failed'" 
          @click="handleRetry"
          class="action-button retry"
        >
          {{ t('migration.retry') }}
        </button>
        
        <button 
          v-if="status === 'failed'" 
          @click="handleClose"
          class="action-button secondary"
        >
          {{ t('migration.close') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { MigrationService } from '../../../bindings/voidraft/internal/services';

interface MigrationProgress {
  status: string;
  currentFile: string;
  processedFiles: number;
  totalFiles: number;
  processedBytes: number;
  totalBytes: number;
  progress: number;
  message: string;
  error?: string;
  startTime: string;
  estimatedTime: number;
}

interface Props {
  visible: boolean;
}

interface Emits {
  (e: 'complete'): void;
  (e: 'close'): void;
  (e: 'retry'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();
const { t } = useI18n();

// 迁移进度状态
const progress = ref<MigrationProgress>({
  status: 'idle',
  currentFile: '',
  processedFiles: 0,
  totalFiles: 0,
  processedBytes: 0,
  totalBytes: 0,
  progress: 0,
  message: '',
  startTime: '',
  estimatedTime: 0
});

const status = computed(() => progress.value.status);

// 定时器用于轮询进度
let progressTimer: number | null = null;

// 轮询迁移进度
const pollProgress = async () => {
  try {
    const currentProgress = await MigrationService.GetProgress();
    progress.value = currentProgress;
    
    // 如果迁移完成或失败，停止轮询
    if (currentProgress.status === 'completed' || currentProgress.status === 'failed' || currentProgress.status === 'cancelled') {
      stopPolling();
    }
  } catch (error) {
    console.error('Failed to get migration progress:', error);
  }
};

// 开始轮询
const startPolling = () => {
  if (progressTimer) return;
  
  // 立即获取一次进度
  pollProgress();
  
  // 每500ms轮询一次
  progressTimer = window.setInterval(pollProgress, 500);
};

// 停止轮询
const stopPolling = () => {
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
};

// 监听可见性变化
watch(() => props.visible, (visible) => {
  if (visible) {
    startPolling();
  } else {
    stopPolling();
  }
});

// 组件挂载时开始轮询（如果可见）
onMounted(() => {
  if (props.visible) {
    startPolling();
  }
});

// 组件卸载时停止轮询
onUnmounted(() => {
  stopPolling();
});

// 获取状态文本
const getStatusText = () => {
  switch (status.value) {
    case 'preparing':
      return t('migration.preparing');
    case 'migrating':
      return t('migration.migrating');
    case 'completed':
      return t('migration.completed');
    case 'failed':
      return t('migration.failed');
    case 'cancelled':
      return t('migration.cancelled');
    default:
      return t('migration.idle');
  }
};

// 格式化字节数
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

// 格式化持续时间
const formatDuration = (nanoseconds: number): string => {
  const seconds = Math.floor(nanoseconds / 1000000000);
  
  if (seconds < 60) {
    return `${seconds}秒`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}分钟`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}小时${minutes}分钟`;
  }
};

// 处理完成
const handleComplete = () => {
  emit('complete');
};

// 处理重试
const handleRetry = () => {
  emit('retry');
};

// 处理关闭
const handleClose = () => {
  emit('close');
};
</script>

<style scoped lang="scss">
.migration-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(4px);
}

.migration-modal {
  background-color: #2a2a2a;
  border-radius: 8px;
  border: 1px solid #444444;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  overflow: hidden;
  animation: modalSlideIn 0.3s ease-out;
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.migration-header {
  padding: 20px 24px 16px;
  border-bottom: 1px solid #444444;
  
  h3 {
    margin: 0 0 8px 0;
    color: #e0e0e0;
    font-size: 18px;
    font-weight: 600;
  }
  
  .migration-status {
    font-size: 14px;
    font-weight: 500;
    padding: 4px 8px;
    border-radius: 4px;
    display: inline-block;
    
    &.preparing {
      color: #ffc107;
      background-color: rgba(255, 193, 7, 0.1);
    }
    
    &.migrating {
      color: #17a2b8;
      background-color: rgba(23, 162, 184, 0.1);
    }
    
    &.completed {
      color: #28a745;
      background-color: rgba(40, 167, 69, 0.1);
    }
    
    &.failed {
      color: #dc3545;
      background-color: rgba(220, 53, 69, 0.1);
    }
    
    &.cancelled {
      color: #6c757d;
      background-color: rgba(108, 117, 125, 0.1);
    }
  }
}

.migration-content {
  padding: 20px 24px;
  max-height: 60vh;
  overflow-y: auto;
}

.progress-container {
  margin-bottom: 20px;
  
  .progress-bar {
    width: 100%;
    height: 8px;
    background-color: #444444;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 8px;
    
    .progress-fill {
      height: 100%;
      transition: width 0.3s ease;
      border-radius: 4px;
      
      &.preparing {
        background-color: #ffc107;
      }
      
      &.migrating {
        background-color: #17a2b8;
        background-image: linear-gradient(
          45deg,
          rgba(255, 255, 255, 0.1) 25%,
          transparent 25%,
          transparent 50%,
          rgba(255, 255, 255, 0.1) 50%,
          rgba(255, 255, 255, 0.1) 75%,
          transparent 75%,
          transparent
        );
        background-size: 20px 20px;
        animation: progressStripes 1s linear infinite;
      }
      
      &.completed {
        background-color: #28a745;
      }
      
      &.failed {
        background-color: #dc3545;
      }
    }
  }
  
  .progress-text {
    text-align: center;
    color: #b0b0b0;
    font-size: 14px;
    font-weight: 500;
  }
}

@keyframes progressStripes {
  0% {
    background-position: 0 0;
  }
  100% {
    background-position: 20px 0;
  }
}

.migration-details {
  .message {
    color: #e0e0e0;
    font-size: 14px;
    margin-bottom: 12px;
    padding: 8px 12px;
    background-color: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
  }
  
  .current-file {
    margin-bottom: 12px;
    font-size: 13px;
    
    .label {
      color: #888888;
    }
    
    .file-name {
      color: #e0e0e0;
      font-family: 'Consolas', 'Courier New', monospace;
      word-break: break-all;
    }
  }
  
  .stats {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 12px;
    
    .stat-item {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      
      .label {
        color: #888888;
      }
      
      .value {
        color: #e0e0e0;
        font-weight: 500;
      }
    }
  }
  
  .error-message {
    margin-top: 16px;
    padding: 12px;
    background-color: rgba(220, 53, 69, 0.1);
    border: 1px solid rgba(220, 53, 69, 0.3);
    border-radius: 4px;
    color: #ff6b6b;
    font-size: 13px;
    display: flex;
    align-items: flex-start;
    gap: 8px;
    
    .error-icon {
      flex-shrink: 0;
    }
  }
}

.migration-actions {
  padding: 16px 24px 20px;
  border-top: 1px solid #444444;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  
  .action-button {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    
    &.success {
      background-color: #28a745;
      color: white;
      
      &:hover {
        background-color: #218838;
      }
    }
    
    &.retry {
      background-color: #17a2b8;
      color: white;
      
      &:hover {
        background-color: #138496;
      }
    }
    
    &.secondary {
      background-color: #6c757d;
      color: white;
      
      &:hover {
        background-color: #5a6268;
      }
    }
    
    &:active {
      transform: translateY(1px);
    }
  }
}

/* 自定义滚动条 */
.migration-content::-webkit-scrollbar {
  width: 6px;
}

.migration-content::-webkit-scrollbar-track {
  background: #333333;
  border-radius: 3px;
}

.migration-content::-webkit-scrollbar-thumb {
  background: #666666;
  border-radius: 3px;
  
  &:hover {
    background: #777777;
  }
}
</style> 