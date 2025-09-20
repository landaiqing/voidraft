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

    <!-- Go代码格式化测试区域 -->
    <SettingSection title="Go Code Formatter Test">
      <SettingItem title="Go Code Input">
        <textarea
          v-model="goCode"
          placeholder="Enter Go code to format..."
          class="select-input code-textarea"
          rows="8"
        ></textarea>
      </SettingItem>
      <SettingItem title="Actions">
        <div class="button-group">
          <button @click="testGoFormatter" class="test-button primary" :disabled="isFormatting">
            {{ isFormatting ? 'Formatting...' : 'Format Go Code' }}
          </button>
          <button @click="resetGoCode" class="test-button">
            Reset to Sample
          </button>
          <button @click="loadComplexSample" class="test-button">
            Load Complex Sample
          </button>
          <button @click="loadBrokenSample" class="test-button">
            Load Broken Sample
          </button>
           <button @click="checkWasmStatus" class="test-button">
             Check WASM Status
           </button>
           <button @click="initializeGoWasm" class="test-button" :disabled="isInitializing">
             {{ isInitializing ? 'Initializing...' : 'Initialize Go WASM' }}
           </button>
        </div>
      </SettingItem>
      
      <!-- 加载状态和进度 -->
      <div v-if="formatStatus" class="test-status detailed-status">
        <div class="status-header" :class="formatStatus.type">
          <strong>{{ formatStatus.type.toUpperCase() }}:</strong> {{ formatStatus.message }}
        </div>
        <div v-if="formatStatus.details" class="status-details">
          <div v-for="(detail, index) in formatStatus.details" :key="index" class="status-detail">
            <span class="detail-time">[{{ detail.time }}]</span>
            <span class="detail-message">{{ detail.message }}</span>
          </div>
        </div>
        <div v-if="formatStatus.duration" class="status-duration">
          执行时间: {{ formatStatus.duration }}ms
        </div>
      </div>

      <!-- 格式化结果 -->
      <SettingItem v-if="formattedCode" title="Formatted Result">
        <textarea
          v-model="formattedCode"
          readonly
          class="select-input code-textarea result-textarea"
          rows="8"
        ></textarea>
      </SettingItem>
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
import { format } from 'prettier'
import goPrettierPlugin from '@/common/prettier/plugins/go'

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

// Go代码格式化测试状态
const goCode = ref(`package main

import(
"fmt"
"os"
)

func main(){
if len(os.Args)<2{
fmt.Println("Usage: program <name>")
return
}
name:=os.Args[1]
fmt.Printf("Hello, %s!\\n",name)
}`)

const formattedCode = ref('')
const isFormatting = ref(false)
const isInitializing = ref(false)
const formatStatus = ref<{
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  details?: Array<{ time: string; message: string }>;
  duration?: number;
} | null>(null)

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

// Go代码格式化相关函数
const addFormatDetail = (message: string) => {
  const time = new Date().toLocaleTimeString()
  if (!formatStatus.value) {
    formatStatus.value = {
      type: 'info',
      message: '正在执行...',
      details: []
    }
  }
  if (!formatStatus.value.details) {
    formatStatus.value.details = []
  }
  formatStatus.value.details.push({ time, message })
}

// 检查WASM状态
const checkWasmStatus = async () => {
  formatStatus.value = {
    type: 'info',
    message: '检查WASM状态...',
    details: []
  }
  
  addFormatDetail('开始检查环境...')
  
  try {
    // 检查浏览器环境
    addFormatDetail('检查浏览器环境支持')
    if (typeof WebAssembly === 'undefined') {
      throw new Error('WebAssembly not supported in this browser')
    }
    addFormatDetail('✅ WebAssembly 支持正常')
    
    // 检查Go运行时
    addFormatDetail('检查Go运行时状态')
    if (typeof globalThis.Go !== 'undefined') {
      addFormatDetail('✅ Go运行时已加载')
    } else {
      addFormatDetail('❌ Go运行时未加载')
    }
    
    // 检查formatGo函数
    addFormatDetail('检查formatGo函数')
    if (typeof globalThis.formatGo === 'function') {
      addFormatDetail('✅ formatGo函数可用')
    } else {
      addFormatDetail('❌ formatGo函数不可用')
    }
    
    // 检查WASM文件可访问性
    addFormatDetail('检查WASM文件可访问性')
    try {
      const response = await fetch('/go.wasm', { method: 'HEAD' })
      if (response.ok) {
        addFormatDetail('✅ go.wasm文件可访问')
      } else {
        addFormatDetail(`❌ go.wasm文件不可访问: ${response.status}`)
      }
    } catch (error) {
      addFormatDetail(`❌ go.wasm文件访问失败: ${error}`)
    }
    
    // 检查wasm_exec.js
    addFormatDetail('检查wasm_exec.js文件')
    try {
      const response = await fetch('/wasm_exec.js', { method: 'HEAD' })
      if (response.ok) {
        addFormatDetail('✅ wasm_exec.js文件可访问')
      } else {
        addFormatDetail(`❌ wasm_exec.js文件不可访问: ${response.status}`)
      }
    } catch (error) {
      addFormatDetail(`❌ wasm_exec.js文件访问失败: ${error}`)
    }
    
    formatStatus.value.type = 'success'
    formatStatus.value.message = 'WASM状态检查完成'
    
  } catch (error: any) {
    addFormatDetail(`❌ 检查失败: ${error.message}`)
    formatStatus.value.type = 'error'
    formatStatus.value.message = `WASM状态检查失败: ${error.message}`
  }
}

// 手动初始化 Go WASM
const initializeGoWasm = async () => {
  if (isInitializing.value) return
  
  isInitializing.value = true
  
  formatStatus.value = {
    type: 'info',
    message: '正在初始化 Go WASM...',
    details: []
  }
  
  try {
    addFormatDetail('开始手动初始化 Go WASM')
    
    // 直接调用插件的初始化函数
    const { initialize } = await import('@/common/prettier/plugins/go')
    
    addFormatDetail('调用插件初始化函数...')
    await initialize()
    
    addFormatDetail('检查 formatGo 函数是否可用...')
    if (typeof globalThis.formatGo === 'function') {
      addFormatDetail('✅ formatGo 函数初始化成功')
      
      // 测试函数
      addFormatDetail('测试 formatGo 函数...')
      const testCode = 'package main\nfunc main(){}'
      const result = globalThis.formatGo(testCode)
      addFormatDetail(`✅ 测试成功，格式化后长度: ${result.length}`)
      
      formatStatus.value = {
        type: 'success',
        message: 'Go WASM 初始化成功！',
        details: formatStatus.value.details
      }
    } else {
      throw new Error('formatGo 函数仍然不可用')
    }
    
  } catch (error: any) {
    addFormatDetail(`❌ 初始化失败: ${error.message}`)
    formatStatus.value = {
      type: 'error',
      message: `Go WASM 初始化失败: ${error.message}`,
      details: formatStatus.value.details
    }
  } finally {
    isInitializing.value = false
  }
}

// 测试Go代码格式化
const testGoFormatter = async () => {
  if (isFormatting.value) return
  
  isFormatting.value = true
  formattedCode.value = ''
  
  const startTime = Date.now()
  
  formatStatus.value = {
    type: 'info',
    message: '正在格式化Go代码...',
    details: []
  }
  
  try {
    addFormatDetail('开始格式化流程')
    addFormatDetail(`输入代码长度: ${goCode.value.length} 字符`)
    
    // 设置超时检测
    const timeoutId = setTimeout(() => {
      addFormatDetail('⚠️ 格式化超时 (10秒)，可能存在阻塞')
    }, 10000)
    
    addFormatDetail('调用prettier格式化...')
    
    const result = await format(goCode.value, {
      parser: 'go-format',
      plugins: [goPrettierPlugin]
    })
    
    clearTimeout(timeoutId)
    
    const duration = Date.now() - startTime
    
    addFormatDetail('✅ 格式化完成')
    addFormatDetail(`输出代码长度: ${result.length} 字符`)
    
    formattedCode.value = result
    
    formatStatus.value = {
      type: 'success',
      message: '代码格式化成功！',
      details: formatStatus.value.details,
      duration
    }
    
  } catch (error: any) {
    const duration = Date.now() - startTime
    
    addFormatDetail(`❌ 格式化失败: ${error.message}`)
    
    // 详细错误分析
    if (error.message.includes('WASM')) {
      addFormatDetail('可能原因: WASM模块加载或初始化问题')
    } else if (error.message.includes('formatGo')) {
      addFormatDetail('可能原因: Go函数未正确暴露到全局作用域')
    } else if (error.message.includes('timeout')) {
      addFormatDetail('可能原因: 代码执行超时或阻塞')
    }
    
    formatStatus.value = {
      type: 'error',
      message: `格式化失败: ${error.message}`,
      details: formatStatus.value.details,
      duration
    }
  } finally {
    isFormatting.value = false
  }
}

// 重置Go代码为示例
const resetGoCode = () => {
  goCode.value = `package main

import(
"fmt"
"os"
)

func main(){
if len(os.Args)<2{
fmt.Println("Usage: program <name>")
return
}
name:=os.Args[1]
fmt.Printf("Hello, %s!\\n",name)
}`
  formattedCode.value = ''
  formatStatus.value = null
}

// 加载复杂示例
const loadComplexSample = () => {
  goCode.value = `package main

import(
"encoding/json"
"fmt"
"io/ioutil"
"log"
"net/http"
"os"
"strconv"
"strings"
"time"
)

type User struct{
ID int \`json:"id"\`
Name string \`json:"name"\`
Email string \`json:"email"\`
CreatedAt time.Time \`json:"created_at"\`
}

type UserService struct{
users []User
nextID int
}

func NewUserService()*UserService{
return &UserService{
users:make([]User,0),
nextID:1,
}
}

func(s *UserService)CreateUser(name,email string)*User{
user:=User{
ID:s.nextID,
Name:name,
Email:email,
CreatedAt:time.Now(),
}
s.users=append(s.users,user)
s.nextID++
return &user
}

func(s *UserService)GetUser(id int)*User{
for i:=range s.users{
if s.users[i].ID==id{
return &s.users[i]
}
}
return nil
}

func(s *UserService)ListUsers()[]User{
return s.users
}

func main(){
service:=NewUserService()

http.HandleFunc("/users",func(w http.ResponseWriter,r *http.Request){
switch r.Method{
case http.MethodGet:
users:=service.ListUsers()
w.Header().Set("Content-Type","application/json")
json.NewEncoder(w).Encode(users)
case http.MethodPost:
body,err:=ioutil.ReadAll(r.Body)
if err!=nil{
http.Error(w,"Bad request",http.StatusBadRequest)
return
}
var req struct{
Name string \`json:"name"\`
Email string \`json:"email"\`
}
if err:=json.Unmarshal(body,&req);err!=nil{
http.Error(w,"Invalid JSON",http.StatusBadRequest)
return
}
user:=service.CreateUser(req.Name,req.Email)
w.Header().Set("Content-Type","application/json")
w.WriteHeader(http.StatusCreated)
json.NewEncoder(w).Encode(user)
default:
http.Error(w,"Method not allowed",http.StatusMethodNotAllowed)
}
})

http.HandleFunc("/users/",func(w http.ResponseWriter,r *http.Request){
if r.Method!=http.MethodGet{
http.Error(w,"Method not allowed",http.StatusMethodNotAllowed)
return
}
idStr:=strings.TrimPrefix(r.URL.Path,"/users/")
id,err:=strconv.Atoi(idStr)
if err!=nil{
http.Error(w,"Invalid user ID",http.StatusBadRequest)
return
}
user:=service.GetUser(id)
if user==nil{
http.Error(w,"User not found",http.StatusNotFound)
return
}
w.Header().Set("Content-Type","application/json")
json.NewEncoder(w).Encode(user)
})

port:=os.Getenv("PORT")
if port==""{
port="8080"
}

fmt.Printf("Server starting on port %s\\n",port)
log.Fatal(http.ListenAndServe(":"+port,nil))
}`
  formattedCode.value = ''
  formatStatus.value = null
}

// 加载有语法错误的示例
const loadBrokenSample = () => {
  goCode.value = `package main

import(
"fmt"
"os
)

func main({
if len(os.Args<2{
fmt.Println("Usage: program <name>")
return
}
name:=os.Args[1
fmt.Printf("Hello, %s!\\n",name)
`
  formattedCode.value = ''
  formatStatus.value = null
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
    // 清空Go测试状态
    formattedCode.value = ''
    formatStatus.value = null
    resetGoCode()
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
  
  &.code-textarea {
    font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
    font-size: 11px;
    line-height: 1.5;
    width: 100%;
    max-width: 600px;
    min-height: 120px;
    white-space: pre;
    overflow-wrap: normal;
    word-break: normal;
    tab-size: 2;
    
    &.result-textarea {
      background-color: var(--settings-card-bg);
      border-color: #22c55e;
      color: var(--settings-text);
    }
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

.detailed-status {
  .status-header {
    margin-bottom: 8px;
    font-weight: 600;
  }
  
  .status-details {
    background-color: rgba(0, 0, 0, 0.05);
    border-radius: 4px;
    padding: 8px;
    margin: 8px 0;
    max-height: 200px;
    overflow-y: auto;
    font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace;
    font-size: 10px;
    line-height: 1.4;
    
    .status-detail {
      margin-bottom: 2px;
      display: flex;
      gap: 8px;
      
      .detail-time {
        color: var(--settings-text-secondary);
        flex-shrink: 0;
        font-weight: 500;
      }
      
      .detail-message {
        color: var(--settings-text);
        word-break: break-word;
      }
    }
  }
  
  .status-duration {
    margin-top: 8px;
    font-size: 10px;
    color: var(--settings-text-secondary);
    font-weight: 500;
  }
}
</style>
