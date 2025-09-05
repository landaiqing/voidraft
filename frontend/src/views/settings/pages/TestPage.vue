<template>
  <div class="settings-page">
    <SettingSection title="Development Test Page">
      <div class="dev-description">
        This page is only available in development environment for testing notification and badge services.
      </div>
    </SettingSection>

    <!-- Badge测试区域 -->
    <SettingSection title="Badge Service Test">
      <SettingItem title="Badge Text">
        <input
          v-model="badgeText"
          type="text"
          placeholder="Enter badge text (empty to remove)"
          class="select-input"
        />
      </SettingItem>
      <SettingItem title="Actions">
        <div class="button-group">
          <button @click="testBadge" class="test-button primary">
            Set Badge
          </button>
          <button @click="clearBadge" class="test-button">
            Clear Badge
          </button>
        </div>
      </SettingItem>
      <div v-if="badgeStatus" class="test-status" :class="badgeStatus.type">
        {{ badgeStatus.message }}
      </div>
    </SettingSection>

    <!-- 通知测试区域 -->
    <SettingSection title="Notification Service Test">
      <SettingItem title="Title">
        <input
          v-model="notificationTitle"
          type="text"
          placeholder="Notification title"
          class="select-input"
        />
      </SettingItem>
      <SettingItem title="Subtitle">
        <input
          v-model="notificationSubtitle"
          type="text"
          placeholder="Notification subtitle"
          class="select-input"
        />
      </SettingItem>
      <SettingItem title="Body">
        <textarea
          v-model="notificationBody"
          placeholder="Notification body text"
          class="select-input textarea-input"
          rows="3"
        ></textarea>
      </SettingItem>
      <SettingItem title="Actions">
        <div class="button-group">
          <button @click="testNotification" class="test-button primary">
            Send Test Notification
          </button>
          <button @click="testUpdateNotification" class="test-button">
            Test Update Notification
          </button>
        </div>
      </SettingItem>
      <div v-if="notificationStatus" class="test-status" :class="notificationStatus.type">
        {{ notificationStatus.message }}
      </div>
    </SettingSection>

    <!-- 清除所有测试状态 -->
    <SettingSection title="Cleanup">
      <SettingItem title="Clear All">
        <button @click="clearAll" class="test-button danger">
          Clear All Test States
        </button>
      </SettingItem>
      <div v-if="clearStatus" class="test-status" :class="clearStatus.type">
        {{ clearStatus.message }}
      </div>
    </SettingSection>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import * as TestService from '@/../bindings/voidraft/internal/services/testservice'
import SettingSection from '../components/SettingSection.vue'
import SettingItem from '../components/SettingItem.vue'

// Badge测试状态
const badgeText = ref('')
const badgeStatus = ref<{ type: string; message: string } | null>(null)

// 通知测试状态
const notificationTitle = ref('')
const notificationSubtitle = ref('')
const notificationBody = ref('')
const notificationStatus = ref<{ type: string; message: string } | null>(null)

// 清除状态
const clearStatus = ref<{ type: string; message: string } | null>(null)

// 显示状态消息的辅助函数
const showStatus = (statusRef: any, type: 'success' | 'error', message: string) => {
  statusRef.value = { type, message }
  setTimeout(() => {
    statusRef.value = null
  }, 5000)
}

// 测试Badge功能
const testBadge = async () => {
  try {
    await TestService.TestBadge(badgeText.value)
    showStatus(badgeStatus, 'success', `Badge ${badgeText.value ? 'set to: ' + badgeText.value : 'cleared'} successfully`)
  } catch (error: any) {
    showStatus(badgeStatus, 'error', `Failed to set badge: ${error.message || error}`)
  }
}

// 清除Badge
const clearBadge = async () => {
  try {
    await TestService.TestBadge('')
    badgeText.value = ''
    showStatus(badgeStatus, 'success', 'Badge cleared successfully')
  } catch (error: any) {
    showStatus(badgeStatus, 'error', `Failed to clear badge: ${error.message || error}`)
  }
}

// 测试通知功能
const testNotification = async () => {
  try {
    await TestService.TestNotification(
      notificationTitle.value,
      notificationSubtitle.value,
      notificationBody.value
    )
    showStatus(notificationStatus, 'success', 'Notification sent successfully')
  } catch (error: any) {
    showStatus(notificationStatus, 'error', `Failed to send notification: ${error.message || error}`)
  }
}

// 测试更新通知
const testUpdateNotification = async () => {
  try {
    await TestService.TestUpdateNotification()
    showStatus(notificationStatus, 'success', 'Update notification sent successfully (badge + notification)')
  } catch (error: any) {
    showStatus(notificationStatus, 'error', `Failed to send update notification: ${error.message || error}`)
  }
}

// 清除所有测试状态
const clearAll = async () => {
  try {
    await TestService.ClearAll()
    // 清空表单
    badgeText.value = ''
    notificationTitle.value = ''
    notificationSubtitle.value = ''
    notificationBody.value = ''
    showStatus(clearStatus, 'success', 'All test states cleared successfully')
  } catch (error: any) {
    showStatus(clearStatus, 'error', `Failed to clear test states: ${error.message || error}`)
  }
}
</script>

<style scoped lang="scss">
.settings-page {
  padding: 20px 0 20px 0;
}

.dev-description {
  color: var(--settings-text-secondary);
  font-size: 12px;
  line-height: 1.4;
  padding: 8px 0;
}

.select-input {
  padding: 6px 8px;
  border: 1px solid var(--settings-input-border);
  border-radius: 4px;
  background-color: var(--settings-input-bg);
  color: var(--settings-text);
  font-size: 12px;
  width: 180px;
  
  &:focus {
    outline: none;
    border-color: #4a9eff;
    box-shadow: 0 0 0 2px rgba(74, 158, 255, 0.2);
  }
  
  &.textarea-input {
    min-height: 60px;
    resize: vertical;
    font-family: inherit;
    line-height: 1.4;
  }
}

.button-group {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.test-button {
  padding: 6px 12px;
  border: 1px solid var(--settings-border);
  border-radius: 4px;
  background-color: var(--settings-card-bg);
  color: var(--settings-text);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s ease;
  
  &:hover {
    background-color: var(--settings-hover);
  }
  
  &.primary {
    background-color: #4a9eff;
    color: white;
    border-color: #4a9eff;
    
    &:hover {
      background-color: #3a8eef;
      border-color: #3a8eef;
    }
  }
  
  &.danger {
    background-color: var(--text-danger);
    color: white;
    border-color: var(--text-danger);
    
    &:hover {
      opacity: 0.9;
    }
  }
}

.test-status {
  margin-top: 12px;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  border: 1px solid;
  
  &.success {
    background-color: rgba(34, 197, 94, 0.1);
    color: #16a34a;
    border-color: rgba(34, 197, 94, 0.2);
  }
  
  &.error {
    background-color: rgba(239, 68, 68, 0.1);
    color: #dc2626;
    border-color: rgba(239, 68, 68, 0.2);
  }
}
</style>
