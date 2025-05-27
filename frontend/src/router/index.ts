import {createRouter, createWebHistory, RouteRecordRaw} from 'vue-router';
import Editor from '@/editor/Editor.vue';
import Settings from '@/settings/Settings.vue';
import GeneralPage from '@/settings/pages/GeneralPage.vue';
import EditingPage from '@/settings/pages/EditingPage.vue';
import AppearancePage from '@/settings/pages/AppearancePage.vue';
import KeyBindingsPage from '@/settings/pages/KeyBindingsPage.vue';
import UpdatesPage from '@/settings/pages/UpdatesPage.vue';

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
  history: createWebHistory(),
  routes: routes
});

export default router; 