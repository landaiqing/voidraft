import {createRouter, createWebHashHistory, RouteRecordRaw} from 'vue-router';
import Editor from '@/views/editor/Editor.vue';
import Settings from '@/views/settings/Settings.vue';
import GeneralPage from '@/views/settings/pages/GeneralPage.vue';
import EditingPage from '@/views/settings/pages/EditingPage.vue';
import AppearancePage from '@/views/settings/pages/AppearancePage.vue';
import KeyBindingsPage from '@/views/settings/pages/KeyBindingsPage.vue';
import UpdatesPage from '@/views/settings/pages/UpdatesPage.vue';
import ExtensionsPage from '@/views/settings/pages/ExtensionsPage.vue';
import BackupPage from '@/views/settings/pages/BackupPage.vue';
// 测试页面
import TestPage from '@/views/settings/pages/TestPage.vue';

// 基础设置子路由
const settingsChildren: RouteRecordRaw[] = [
  {
    path: 'general',
    name: 'SettingsGeneral',
    component: GeneralPage
  },
  {
    path: 'editing',
    name: 'SettingsEditing',
    component: EditingPage
  },
  {
    path: 'appearance',
    name: 'SettingsAppearance',
    component: AppearancePage
  },
  {
    path: 'extensions',
    name: 'SettingsExtensions',
    component: ExtensionsPage
  },
  {
    path: 'key-bindings',
    name: 'SettingsKeyBindings',
    component: KeyBindingsPage
  },
  {
    path: 'updates',
    name: 'SettingsUpdates',
    component: UpdatesPage
  },
  {
    path: 'backup',
    name: 'SettingsBackup',
    component: BackupPage
  }
];

// 仅在开发环境添加测试页面路由
if (import.meta.env.DEV) {
  settingsChildren.push({
    path: 'test',
    name: 'SettingsTest',
    component: TestPage
  });
}

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Editor',
    component: Editor
  },
  {
    path: '/settings',
    name: 'Settings',
    redirect: '/settings/general',
    component: Settings,
    children: settingsChildren
  }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes: routes
});

export default router;