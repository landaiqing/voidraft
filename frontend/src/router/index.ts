import {createRouter, createWebHistory, RouteRecordRaw} from 'vue-router';
import Editor from '@/editor/Editor.vue';
import SettingsPage from '@/settings/SettingsPage.vue';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Editor',
    component: Editor
  },
  {
    path: '/settings',
    name: 'Settings',
    component: SettingsPage
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes: routes
});

export default router; 