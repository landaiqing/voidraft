import { createApp } from 'vue';
import App from './App.vue';
import '@/assets/styles/style.css';
import '@/assets/styles/normalize.css';
import PrimeVue from 'primevue/config';
import Aura from '@primeuix/themes/aura';

const app = createApp(App);
app.mount('#app');
app.use(PrimeVue, {
    theme: {
        preset: Aura
    }
});
