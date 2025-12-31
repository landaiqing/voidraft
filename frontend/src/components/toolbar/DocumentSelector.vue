<script setup lang="ts">
import {computed, nextTick, reactive, ref, watch} from 'vue';
import {useDocumentStore} from '@/stores/documentStore';
import {useTabStore} from '@/stores/tabStore';
import {useEditorStore} from '@/stores/editorStore';
import {useWindowStore} from '@/stores/windowStore';
import {useI18n} from 'vue-i18n';
import {useConfirm} from '@/composables';
import {validateDocumentTitle} from '@/common/utils/validation';
import {formatDateTime, truncateString} from '@/common/utils/formatter';
import type {Document} from '@/../bindings/voidraft/internal/models/ent/models';

// 类型定义
interface DocumentItem extends Document {
  isCreateOption?: boolean;
}

const documentStore = useDocumentStore();
const tabStore = useTabStore();
const editorStore = useEditorStore();
const windowStore = useWindowStore();
const {t} = useI18n();

// DOM 引用
const inputRef = ref<HTMLInputElement>();
const editInputRef = ref<HTMLInputElement>();

// 组件状态
const state = reactive({
  isLoaded: false,
  searchQuery: '',
  editing: {
    id: null as number | null,
    title: ''
  }
});

// 常量
const MAX_TITLE_LENGTH = 50;
const DELETE_CONFIRM_TIMEOUT = 3000;

// 计算属性
const currentDocName = computed(() => {
  if (!documentStore.currentDocument) return t('toolbar.selectDocument');
  return truncateString(documentStore.currentDocument.title || '', 12);
});

const filteredItems = computed<DocumentItem[]>(() => {
  const docs = documentStore.documentList;
  const query = state.searchQuery.trim();

  if (!query) return docs;

  const filtered = docs.filter(doc =>
      (doc.title || '').toLowerCase().includes(query.toLowerCase())
  );

  // 如果输入的不是已存在文档的完整标题，添加创建选项
  const exactMatch = docs.some(doc => (doc.title || '').toLowerCase() === query.toLowerCase());
  if (!exactMatch && query.length > 0) {
    return [
      {id: -1, title: t('toolbar.createDocument') + ` "${query}"`, isCreateOption: true} as DocumentItem,
      ...filtered
    ];
  }

  return filtered;
});

// 核心操作
const openMenu = async () => {
  await documentStore.getDocumentMetaList();
  documentStore.openDocumentSelector();
  state.isLoaded = true;
  await nextTick();
  inputRef.value?.focus();
};

// 删除确认
const {isConfirming: isDeleting, startConfirm: startDeleteConfirm, reset: resetDeleteConfirm} = useConfirm({
  timeout: DELETE_CONFIRM_TIMEOUT
});

const closeMenu = () => {
  state.isLoaded = false;
  documentStore.closeDocumentSelector();
  state.searchQuery = '';
  state.editing.id = null;
  state.editing.title = '';
  resetDeleteConfirm();
};

const selectDoc = async (doc: Document) => {
  if (doc.id === undefined) return;

  // 如果选择的就是当前文档，直接关闭菜单
  if (documentStore.currentDocument?.id === doc.id) {
    closeMenu();
    return;
  }

  const hasOpen = await windowStore.isDocumentWindowOpen(doc.id);
  if (hasOpen) {
    documentStore.setError(doc.id, t('toolbar.alreadyOpenInNewWindow'));
    return;
  }


  const success = await documentStore.openDocument(doc.id);
  if (!success) return;

  const fullDoc = documentStore.currentDocument;
  if (fullDoc && editorStore.hasContainer) {
    await editorStore.loadEditor(fullDoc.id!, fullDoc.content || '');
  }

  if (fullDoc && tabStore.isTabsEnabled) {
    tabStore.addOrActivateTab(fullDoc);
  }

  closeMenu();
};

const createDoc = async (title: string) => {
  const trimmedTitle = title.trim();
  const error = validateDocumentTitle(trimmedTitle, MAX_TITLE_LENGTH);
  if (error) return;

  try {
    const newDoc = await documentStore.createNewDocument(trimmedTitle);
    if (newDoc) await selectDoc(newDoc);
  } catch (error) {
    console.error('Failed to create document:', error);
  }
};

const selectDocItem = async (item: any) => {
  if (item.isCreateOption) {
    await createDoc(state.searchQuery.trim());
  } else {
    await selectDoc(item);
  }
};

// 搜索框回车处理
const handleSearchEnter = () => {
  const query = state.searchQuery.trim();
  if (query && filteredItems.value.length > 0) {
    selectDocItem(filteredItems.value[0]);
  }
};

// 编辑操作
const renameDoc = (doc: Document, event: Event) => {
  event.stopPropagation();
  state.editing.id = doc.id ?? null;
  state.editing.title = doc.title || '';
  resetDeleteConfirm();
  nextTick(() => {
    editInputRef.value?.focus();
    editInputRef.value?.select();
  });
};

const saveEdit = async () => {
  if (!state.editing.id || !state.editing.title.trim()) {
    state.editing.id = null;
    state.editing.title = '';
    return;
  }

  const trimmedTitle = state.editing.title.trim();
  const error = validateDocumentTitle(trimmedTitle, MAX_TITLE_LENGTH);
  if (error) return;

  try {
    await documentStore.updateDocumentMetadata(state.editing.id, trimmedTitle);
    await documentStore.getDocumentMetaList();

    // 如果tabs功能开启且该文档有标签页，更新标签页标题
    if (tabStore.isTabsEnabled && tabStore.hasTab(state.editing.id)) {
      tabStore.updateTabTitle(state.editing.id, trimmedTitle);
    }
  } catch (error) {
    console.error('Failed to update document:', error);
  } finally {
    state.editing.id = null;
    state.editing.title = '';
  }
};

const cancelEdit = () => {
  state.editing.id = null;
  state.editing.title = '';
};

// 其他操作
const openInNewWindow = async (doc: Document, event: Event) => {
  event.stopPropagation();
  if (doc.id === undefined) return;
  try {
    // 在打开新窗口前，如果启用了标签且该文档有标签，先关闭标签
    if (tabStore.isTabsEnabled && tabStore.hasTab(doc.id)) {
      await tabStore.closeTab(doc.id);
    }
    await documentStore.openDocumentInNewWindow(doc.id);
  } catch (error) {
    console.error('Failed to open document in new window:', error);
  }
};

const handleDelete = async (doc: Document, event: Event) => {
  event.stopPropagation();
  if (doc.id === undefined) return;

  if (isDeleting(doc.id)) {
    // 确认删除前检查文档是否在其他窗口打开
    const hasOpen = await windowStore.isDocumentWindowOpen(doc.id);
    if (hasOpen) {
      documentStore.setError(doc.id, t('toolbar.alreadyOpenInNewWindow'));
      resetDeleteConfirm();
      return;
    }

    const deleteSuccess = await documentStore.deleteDocument(doc.id);
    if (deleteSuccess) {
      await documentStore.getDocumentMetaList();
      // 如果删除的是当前文档，切换到第一个文档
      if (documentStore.currentDocument?.id === doc.id && documentStore.documentList.length > 0) {
        const firstDoc = documentStore.documentList[0];
        if (firstDoc) await selectDoc(firstDoc);
      }
    }
    resetDeleteConfirm();
  } else {
    // 进入确认状态
    startDeleteConfirm(doc.id);
    state.editing.id = null;
  }
};

// 切换菜单
const toggleMenu = () => {
  if (documentStore.showDocumentSelector) {
    closeMenu();
  } else {
    openMenu();
  }
};

// 监听菜单状态变化
watch(() => documentStore.showDocumentSelector, (isOpen) => {
  if (isOpen && !state.isLoaded) {
    openMenu();
  }
});
</script>

<template>
  <div class="document-selector" v-click-outside="closeMenu">
    <!-- 选择器按钮 -->
    <button class="doc-btn" @click="toggleMenu">
      <span class="doc-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
          <polyline points="14,2 14,8 20,8"></polyline>
        </svg>
      </span>
      <span class="doc-name">{{ currentDocName }}</span>
      <span class="arrow" :class="{ open: state.isLoaded }">▲</span>
    </button>

    <!-- 菜单 -->
    <Transition name="slide-up">
      <div v-if="state.isLoaded" class="doc-menu">
        <!-- 输入框 -->
        <div class="input-box">
          <input
              ref="inputRef"
              v-model="state.searchQuery"
              type="text"
              class="main-input"
              :placeholder="t('toolbar.searchOrCreateDocument')"
              :maxlength="MAX_TITLE_LENGTH"
              @keydown.enter="handleSearchEnter"
              @keydown.esc="closeMenu"
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
              @click="selectDocItem(item)"
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
              <div v-if="state.editing.id !== item.id" class="doc-info">
                <div class="doc-title">{{ item.title }}</div>
                <!-- 根据状态显示错误信息或时间 -->
                <div v-if="documentStore.selectorError?.docId === item.id" class="doc-error">
                  {{ documentStore.selectorError?.message }}
                </div>
                <div v-else class="doc-date">{{ formatDateTime(item.updated_at) }}</div>
              </div>

              <!-- 编辑状态 -->
              <div v-else class="doc-edit">
                <input
                    :ref="el => editInputRef = el as HTMLInputElement"
                    v-model="state.editing.title"
                    type="text"
                    class="edit-input"
                    :maxlength="MAX_TITLE_LENGTH"
                    @keydown.enter="saveEdit"
                    @keydown.esc="cancelEdit"
                    @blur="saveEdit"
                    @click.stop
                />
              </div>

              <!-- 操作按钮 -->
              <div v-if="state.editing.id !== item.id" class="doc-actions">
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
                <button class="action-btn" @click="renameDoc(item, $event)" :title="t('toolbar.rename')">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
                  </svg>
                </button>
                <button
                    v-if="documentStore.documentList.length > 1 && item.id !== 1"
                    class="action-btn delete-btn"
                    :class="{ 'delete-confirm': isDeleting(item.id!) }"
                    @click="handleDelete(item, $event)"
                    :title="isDeleting(item.id!) ? t('toolbar.confirmDelete') : t('toolbar.delete')"
                >
                  <svg v-if="!isDeleting(item.id!)" xmlns="http://www.w3.org/2000/svg" width="12" height="12"
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
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped lang="scss">
.slide-up-enter-active,
.slide-up-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

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

    .doc-icon {
      display: flex;
      align-items: center;
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
    width: 300px;
    max-height: calc(100vh - 40px);
    z-index: 1000;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    overflow: hidden;
    display: flex;
    flex-direction: column;

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
      max-height: calc(100vh - 100px);
      overflow-y: auto;
      flex: 1;

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

              &:hover {
                background-color: var(--bg-hover);
                color: var(--text-secondary);
              }

              &.delete-btn {
                &:hover {
                  color: var(--text-danger);
                }

                &.delete-confirm {
                  background-color: var(--text-danger);
                  color: white;

                  .confirm-text {
                    font-size: 9px;
                    font-weight: 500;
                  }
                }
              }
            }
          }
        }

        &:hover .doc-actions {
          opacity: 1;
        }
      }

      .empty {
        padding: 16px 8px;
        text-align: center;
        font-size: 11px;
        color: var(--text-muted);
      }
    }
  }
}

@keyframes fadeInOut {
  0% {
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}
</style>
