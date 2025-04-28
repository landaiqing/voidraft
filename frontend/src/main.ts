import {createApp} from 'vue';
import App from './App.vue';
import '@/assets/styles/index.css';
import PrimeVue from 'primevue/config';
import Aura from '@primeuix/themes/aura';
import {createPinia} from 'pinia';
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate';
import i18n from './i18n';

const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

const app = createApp(App);
app.use(pinia)
app.use(PrimeVue, {
    theme: {
        preset: Aura
    }
});
app.use(i18n);
app.mount('#app');
