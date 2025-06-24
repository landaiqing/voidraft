import {createRouter, createWebHashHistory, createWebHistory, RouteRecordRaw} from 'vue-router';
import Editor from '@/views/editor/Editor.vue';
import Settings from '@/views/settings/Settings.vue';
import GeneralPage from '@/views/settings/pages/GeneralPage.vue';
import EditingPage from '@/views/settings/pages/EditingPage.vue';
import AppearancePage from '@/views/settings/pages/AppearancePage.vue';
import KeyBindingsPage from '@/views/settings/pages/KeyBindingsPage.vue';
import UpdatesPage from '@/views/settings/pages/UpdatesPage.vue';
import ExtensionsPage from '@/views/settings/pages/ExtensionsPage.vue';

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
    children: [
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
      }
    ]
  }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes: routes
});

export default router; 