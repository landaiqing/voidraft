import { createApp } from 'vue';
import App from './App.vue';
import '@/assets/styles/index.css';
import { createPinia } from 'pinia';
import i18n from './i18n';
import router from './router';
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate';
import { registerDirectives } from './directives';
import {EditorView} from "@codemirror/view";

(EditorView as any).EDIT_CONTEXT = false;

const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);

const app = createApp(App);
app.use(pinia);
app.use(i18n);
app.use(router);
registerDirectives(app);
app.mount('#app');