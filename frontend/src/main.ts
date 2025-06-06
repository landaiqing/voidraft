import {createApp} from 'vue';
import App from './App.vue';
import '@/assets/styles/index.css';
import {createPinia} from 'pinia';
import i18n from './i18n';
import router from './router';
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'

const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)
const app = createApp(App);
app.use(pinia)
app.use(i18n);
app.use(router);
app.mount('#app');