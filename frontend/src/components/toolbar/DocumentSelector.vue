<script setup lang="ts">
import {computed, nextTick, onMounted, onUnmounted, ref} from 'vue';
import {useDocumentStore} from '@/stores/documentStore';
import {useI18n} from 'vue-i18n';
import type {Document} from '@/../bindings/voidraft/internal/models/models';
import {useWindowStore} from "@/stores/windowStore";

const documentStore = useDocumentStore();
const windowStore = useWindowStore();
const {t} = useI18n();

// 组件状态
const showMenu = ref(false);
const inputValue = ref('');
const inputRef = ref<HTMLInputElement>();
const editingId = ref<number | null>(null);
const editingTitle = ref('');
const editInputRef = ref<HTMLInputElement>();
const deleteConfirmId = ref<number | null>(null);
// 添加错误提示状态
const alreadyOpenDocId = ref<number | null>(null);
const errorMessageTimer = ref<number | null>(null);

// 过滤后的文档列表 + 创建选项
const filteredItems = computed(() => {
  const docs = documentStore.documentList;
  const query = inputValue.value.trim();

  if (!query) {
    return docs;
  }

  // 过滤匹配的文档
  const filtered = docs.filter(doc =>
      doc.title.toLowerCase().includes(query.toLowerCase())
  );

  // 如果输入的不是已存在文档的完整标题，添加创建选项
  const exactMatch = docs.some(doc => doc.title.toLowerCase() === query.toLowerCase());
  if (!exactMatch && query.length > 0) {
    return [
      {id: -1, title: t('toolbar.createDocument') + ` "${query}"`, isCreateOption: true} as any,
      ...filtered
    ];
  }

  return filtered;
});

// 当前文档显示名称
const currentDocName = computed(() => {
  if (!documentStore.currentDocument) return t('toolbar.selectDocument');
  const title = documentStore.currentDocument.title;
  return title.length > 12 ? title.substring(0, 12) + '...' : title;
});

// 打开菜单
const openMenu = async () => {
  showMenu.value = true;
  await documentStore.updateDocuments();
  nextTick(() => {
    inputRef.value?.focus();
  });
};

// 关闭菜单
const closeMenu = () => {
  showMenu.value = false;
  inputValue.value = '';
  editingId.value = null;
  editingTitle.value = '';
  deleteConfirmId.value = null;
  
  // 清除错误状态和定时器
  clearErrorMessage();
};

// 清除错误提示和定时器
const clearErrorMessage = () => {
  if (errorMessageTimer.value) {
    clearTimeout(errorMessageTimer.value);
    errorMessageTimer.value = null;
  }
  alreadyOpenDocId.value = null;
};

// 切换菜单
const toggleMenu = () => {
  if (showMenu.value) {
    closeMenu();
  } else {
    openMenu();
  }
};

// 选择文档或创建文档
const selectItem = async (item: any) => {
  if (item.isCreateOption) {
    // 创建新文档
    await createDoc(inputValue.value.trim());
  } else {
    // 选择现有文档
    await selectDoc(item);
  }
};

// 选择文档
const selectDoc = async (doc: Document) => {
  try {
    // 如果选择的就是当前文档，直接关闭菜单
    if (documentStore.currentDocument?.id === doc.id) {
      closeMenu();
      return;
    }

    const hasOpen = await windowStore.isDocumentWindowOpen(doc.id);
    if (hasOpen) {
      // 设置错误状态并启动定时器
      alreadyOpenDocId.value = doc.id;
      
      // 清除之前的定时器（如果存在）
      if (errorMessageTimer.value) {
        clearTimeout(errorMessageTimer.value);
      }
      
      // 设置新的定时器，3秒后清除错误信息
      errorMessageTimer.value = window.setTimeout(() => {
        alreadyOpenDocId.value = null;
        errorMessageTimer.value = null;
      }, 3000);
      return;
    }
    const success = await documentStore.openDocument(doc.id);
    if (success) {
      closeMenu();
    }
  } catch (error) {
    console.error('Failed to switch documents:', error);
  }
};

// 文档名称长度限制
const MAX_TITLE_LENGTH = 50;

// 验证文档名称
const validateTitle = (title: string): string | null => {
  if (!title.trim()) {
    return t('toolbar.documentNameRequired');
  }
  if (title.trim().length > MAX_TITLE_LENGTH) {
    return t('toolbar.documentNameTooLong', {max: MAX_TITLE_LENGTH});
  }
  return null;
};

// 创建文档
const createDoc = async (title: string) => {
  const trimmedTitle = title.trim();
  const error = validateTitle(trimmedTitle);
  if (error) {
    return;
  }

  try {
    const newDoc = await documentStore.createNewDocument(trimmedTitle);
    if (newDoc) {
      await selectDoc(newDoc);
    }
  } catch (error) {
    console.error('Failed to create document:', error);
  }
};

// 开始重命名
const startRename = (doc: Document, event: Event) => {
  event.stopPropagation();
  editingId.value = doc.id;
  editingTitle.value = doc.title;
  deleteConfirmId.value = null; // 清除删除确认状态
  nextTick(() => {
    editInputRef.value?.focus();
    editInputRef.value?.select();
  });
};

// 保存编辑
const saveEdit = async () => {
  if (editingId.value && editingTitle.value.trim()) {
    const trimmedTitle = editingTitle.value.trim();
    const error = validateTitle(trimmedTitle);
    if (error) {

      return;
    }

    try {
      await documentStore.updateDocumentMetadata(editingId.value, trimmedTitle);
      await documentStore.updateDocuments();
    } catch (error) {
      return;
    }
  }
  editingId.value = null;
  editingTitle.value = '';
};

// 在新窗口打开文档
const openInNewWindow = async (doc: Document, event: Event) => {
  event.stopPropagation();
  try {
    await documentStore.openDocumentInNewWindow(doc.id);
  } catch (error) {
    console.error('Failed to open document in new window:', error);
  }
};

// 处理删除
const handleDelete = async (doc: Document, event: Event) => {
  event.stopPropagation();

  if (deleteConfirmId.value === doc.id) {
    // 确认删除前检查文档是否在其他窗口打开
    try {
      const hasOpen = await windowStore.isDocumentWindowOpen(doc.id);
      if (hasOpen) {
        // 设置错误状态并启动定时器
        alreadyOpenDocId.value = doc.id;
        
        // 清除之前的定时器（如果存在）
        if (errorMessageTimer.value) {
          clearTimeout(errorMessageTimer.value);
        }
        
        // 设置新的定时器，3秒后清除错误信息
        errorMessageTimer.value = window.setTimeout(() => {
          alreadyOpenDocId.value = null;
          errorMessageTimer.value = null;
        }, 3000);
        
        // 取消删除确认状态
        deleteConfirmId.value = null;
        return;
      }
      
      const deleteSuccess = await documentStore.deleteDocument(doc.id);

      if (!deleteSuccess) {
        return;
      }
      
      await documentStore.updateDocuments();
      // 如果删除的是当前文档，切换到第一个文档
      if (documentStore.currentDocument?.id === doc.id && documentStore.documentList.length > 0) {
        const firstDoc = documentStore.documentList[0];
        if (firstDoc) {
          await selectDoc(firstDoc);
        }
      }
    } catch (error) {
      console.error('deleted failed:', error);
    }
    deleteConfirmId.value = null;
  } else {
    // 进入确认状态
    deleteConfirmId.value = doc.id;
    editingId.value = null; // 清除编辑状态

    // 3秒后自动取消确认状态
    setTimeout(() => {
      if (deleteConfirmId.value === doc.id) {
        deleteConfirmId.value = null;
      }
    }, 3000);
  }
};

// 格式化时间
const formatTime = (dateString: string | null) => {
  if (!dateString) return t('toolbar.unknownTime');

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return t('toolbar.invalidDate');

    // 根据当前语言显示时间格式
    const locale = t('locale') === 'zh-CN' ? 'zh-CN' : 'en-US';
    return date.toLocaleString(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  } catch (error) {
    return t('toolbar.timeError');
  }
};

// 键盘事件
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    if (editingId.value) {
      editingId.value = null;
      editingTitle.value = '';
    } else if (deleteConfirmId.value) {
      deleteConfirmId.value = null;
    } else {
      closeMenu();
    }
  }
};

// 输入框键盘事件
const handleInputKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    const query = inputValue.value.trim();
    if (query) {
      // 如果有匹配的项目，选择第一个
      if (filteredItems.value.length > 0) {
        selectItem(filteredItems.value[0]);
      }
    }
  } else if (event.key === 'Escape') {
    event.preventDefault();
    closeMenu();
  }
  event.stopPropagation();
};

// 编辑键盘事件
const handleEditKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    saveEdit();
  } else if (event.key === 'Escape') {
    event.preventDefault();
    editingId.value = null;
    editingTitle.value = '';
  }
  event.stopPropagation();
};

// 点击外部关闭
const handleClickOutside = (event: Event) => {
  const target = event.target as HTMLElement;
  if (!target.closest('.document-selector')) {
    closeMenu();
  }
};

// 生命周期
onMounted(() => {
  document.addEventListener('click', handleClickOutside);
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  document.removeEventListener('keydown', handleKeydown);
  // 清理定时器
  if (errorMessageTimer.value) {
    clearTimeout(errorMessageTimer.value);
  }
});
</script>

<template>
  <div class="document-selector">
    <!-- 选择器按钮 -->
    <button class="doc-btn" @click="toggleMenu">
      <span class="doc-name">{{ currentDocName }}</span>
      <span class="arrow" :class="{ open: showMenu }">▲</span>
    </button>

    <!-- 菜单 -->
    <div v-if="showMenu" class="doc-menu">
      <!-- 输入框 -->
      <div class="input-box">
        <input
            ref="inputRef"
            v-model="inputValue"
            type="text"
            class="main-input"
            :placeholder="t('toolbar.searchOrCreateDocument')"
            :maxlength="MAX_TITLE_LENGTH"
            @keydown="handleInputKeydown"
        />
        <svg class="input-icon" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
        </svg>
      </div>

      <!-- 项目列表 -->
      <div class="item-list">
        <div
            v-for="item in filteredItems"
            :key="item.id"
            class="list-item"
            :class="{
            'active': !item.isCreateOption && documentStore.currentDocument?.id === item.id,
            'create-item': item.isCreateOption
          }"
            @click="selectItem(item)"
        >
          <!-- 创建选项 -->
          <div v-if="item.isCreateOption" class="create-option">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 12h14"></path>
              <path d="M12 5v14"></path>
            </svg>
            <span>{{ item.title }}</span>
          </div>

          <!-- 文档项 -->
          <div v-else class="doc-item-content">
            <!-- 普通显示 -->
            <div v-if="editingId !== item.id" class="doc-info">
              <div class="doc-title">{{ item.title }}</div>
              <!-- 根据状态显示错误信息或时间 -->
              <div v-if="alreadyOpenDocId === item.id" class="doc-error">
                {{ t('toolbar.alreadyOpenInNewWindow') }}
              </div>
              <div v-else class="doc-date">{{ formatTime(item.updatedAt) }}</div>
            </div>

            <!-- 编辑状态 -->
            <div v-else class="doc-edit">
              <input
                  :ref="el => editInputRef = el as HTMLInputElement"
                  v-model="editingTitle"
                  type="text"
                  class="edit-input"
                  :maxlength="MAX_TITLE_LENGTH"
                  @keydown="handleEditKeydown"
                  @blur="saveEdit"
                  @click.stop
              />
            </div>

            <!-- 操作按钮 -->
            <div v-if="editingId !== item.id" class="doc-actions">
              <!-- 只有非当前文档才显示在新窗口打开按钮 -->
              <button
                  v-if="documentStore.currentDocument?.id !== item.id"
                  class="action-btn"
                  @click="openInNewWindow(item, $event)"
                  :title="t('toolbar.openInNewWindow')"
              >
                <svg width="12" height="12" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg"
                     fill="currentColor">
                  <path
                      d="M172.8 1017.6c-89.6 0-166.4-70.4-166.4-166.4V441.6c0-89.6 70.4-166.4 166.4-166.4h416c89.6 0 166.4 70.4 166.4 166.4v416c0 89.6-70.4 166.4-166.4 166.4l-416-6.4z m0-659.2c-51.2 0-89.6 38.4-89.6 89.6v416c0 51.2 38.4 89.6 89.6 89.6h416c51.2 0 89.6-38.4 89.6-89.6V441.6c0-51.2-38.4-89.6-89.6-89.6H172.8z"></path>
                  <path
                      d="M851.2 19.2H435.2C339.2 19.2 268.8 96 268.8 185.6v25.6h70.4v-25.6c0-51.2 38.4-89.6 89.6-89.6h409.6c51.2 0 89.6 38.4 89.6 89.6v409.6c0 51.2-38.4 89.6-89.6 89.6h-38.4V768h51.2c96 0 166.4-76.8 166.4-166.4V185.6c0-96-76.8-166.4-166.4-166.4z"></path>
                </svg>
              </button>
              <button class="action-btn" @click="startRename(item, $event)" :title="t('toolbar.rename')">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
                </svg>
              </button>
              <button
                  v-if="documentStore.documentList.length > 1 && item.id !== 1"
                  class="action-btn delete-btn"
                  :class="{ 'delete-confirm': deleteConfirmId === item.id }"
                  @click="handleDelete(item, $event)"
                  :title="deleteConfirmId === item.id ? t('toolbar.confirmDelete') : t('toolbar.delete')"
              >
                <svg v-if="deleteConfirmId !== item.id" xmlns="http://www.w3.org/2000/svg" width="12" height="12"
                     viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                     stroke-linejoin="round">
                  <polyline points="3,6 5,6 21,6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                <span v-else class="confirm-text">{{ t('toolbar.confirm') }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-if="filteredItems.length === 0" class="empty">
          {{ t('toolbar.noDocumentFound') }}
        </div>

        <!-- 加载状态 -->
        <div v-if="documentStore.isLoading" class="loading">
          {{ t('toolbar.loading') }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.document-selector {
  position: relative;

  .doc-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 11px;
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 2px 4px;
    border-radius: 3px;

    &:hover {
      background-color: var(--border-color);
      opacity: 0.8;
    }

    .doc-name {
      max-width: 80px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .arrow {
      font-size: 8px;
      margin-left: 2px;
      transition: transform 0.2s ease;

      &.open {
        transform: rotate(180deg);
      }
    }
  }

  .doc-menu {
    position: absolute;
    bottom: 100%;
    right: 0;
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 3px;
    margin-bottom: 4px;
    width: 260px;
    max-height: 320px;
    z-index: 1000;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    overflow: hidden;

    .input-box {
      position: relative;
      padding: 8px;
      border-bottom: 1px solid var(--border-color);

      .main-input {
        width: 100%;
        box-sizing: border-box;
        background-color: var(--bg-primary);
        border: 1px solid var(--border-color);
        border-radius: 2px;
        padding: 5px 8px 5px 26px;
        font-size: 11px;
        color: var(--text-primary);
        outline: none;

        &:focus {
          border-color: var(--text-muted);
        }

        &::placeholder {
          color: var(--text-muted);
        }
      }

      .input-icon {
        position: absolute;
        left: 14px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--text-muted);
        pointer-events: none;
      }
    }

    .item-list {
      max-height: 240px;
      overflow-y: auto;

      .list-item {
        cursor: pointer;
        border-bottom: 1px solid var(--border-color);

        &:hover {
          background-color: var(--bg-hover);
        }

        &.active {
          background-color: var(--selection-bg);

          .doc-item-content .doc-info {
            .doc-title {
              color: var(--selection-text);
            }

            .doc-date, .doc-error {
              color: var(--selection-text);
              opacity: 0.7;
            }
          }
        }

        &.create-item {
          .create-option {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 8px;
            font-size: 11px;
            font-weight: normal;

            svg {
              flex-shrink: 0;
              color: var(--text-muted);
            }
          }
        }

        .doc-item-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 8px;

          .doc-info {
            flex: 1;
            min-width: 0;

            .doc-title {
              font-size: 12px;
              margin-bottom: 2px;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
              font-weight: normal;
            }

            .doc-date {
              font-size: 10px;
              color: var(--text-muted);
              opacity: 0.6;
            }
            
            .doc-error {
              font-size: 10px;
              color: var(--text-danger);
              font-weight: 500;
              animation: fadeInOut 3s forwards;
            }
          }

          .doc-edit {
            flex: 1;

            .edit-input {
              width: 100%;
              box-sizing: border-box;
              background-color: var(--bg-primary);
              border: 1px solid var(--border-color);
              border-radius: 2px;
              padding: 4px 6px;
              font-size: 11px;
              color: var(--text-primary);
              outline: none;

              &:focus {
                border-color: var(--text-muted);
              }
            }
          }

          .doc-actions {
            display: flex;
            gap: 6px;
            opacity: 0;
            transition: opacity 0.2s ease;

            .action-btn {
              background: none;
              border: none;
              color: var(--text-muted);
              cursor: pointer;
              padding: 4px;
              border-radius: 2px;
              display: flex;
              align-items: center;
              justify-content: center;
              min-width: 20px;
              min-height: 20px;

              svg {
                width: 12px;
                height: 12px;
              }

              &:hover {
                background-color: var(--border-color);
                color: var(--text-primary);
              }

              &.delete-btn:hover {
                color: var(--text-danger);
              }

              &.delete-confirm {
                background-color: var(--text-danger);
                color: white;

                .confirm-text {
                  font-size: 10px;
                  padding: 0 4px;
                  font-weight: normal;
                }

                &:hover {
                  background-color: var(--text-danger);
                  color: white !important; // 确保确认状态下文字始终为白色
                  opacity: 0.8;
                }
              }
            }
          }
        }

        &:hover .doc-actions {
          opacity: 1;
        }
      }

      .empty, .loading {
        padding: 12px 8px;
        text-align: center;
        font-size: 11px;
        color: var(--text-muted);
      }
    }
  }

  // 自定义滚动条
  .item-list {
    &::-webkit-scrollbar {
      width: 4px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }

    &::-webkit-scrollbar-thumb {
      background-color: var(--border-color);
      border-radius: 2px;

      &:hover {
        background-color: var(--text-muted);
      }
    }
  }
}

@keyframes fadeInOut {
  0% {
    opacity: 1;
  }
  70% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}
</style>