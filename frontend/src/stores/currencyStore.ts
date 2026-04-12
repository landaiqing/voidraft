import {defineStore} from 'pinia';
import {readonly, ref} from 'vue';
import {CurrencyService} from '@/../bindings/voidraft/internal/services';
import {useEditorStore} from './editorStore';

declare global {
    interface Window {
        math: any;
    }
}

const CURRENCY_REFRESH_INTERVAL = 1000 * 3600 * 4;

export const useCurrencyStore = defineStore('currency', () => {
    const editorStore = useEditorStore();

    const initialized = ref(false);
    const currenciesLoaded = ref(false);
    const isLoading = ref(false);
    const lastLoadedAt = ref<number | null>(null);

    let refreshTimer: number | null = null;

    const applyCurrencies = async (): Promise<boolean> => {
        if (isLoading.value) {
            return false;
        }

        if (typeof window === 'undefined' || typeof window.math === 'undefined') {
            return false;
        }

        isLoading.value = true;

        try {
            const data = await CurrencyService.GetCurrencyData();
            if (!data?.base || !data?.rates) {
                return false;
            }

            const math = window.math;

            if (!currenciesLoaded.value) {
                math.createUnit(data.base, {
                    override: false,
                    aliases: [data.base.toLowerCase()],
                });
            }

            Object.entries(data.rates)
                .filter(([currency]) => currency !== data.base)
                .forEach(([currency, rate]) => {
                    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
                        return;
                    }

                    math.createUnit(currency, {
                        definition: math.unit(1 / rate, data.base),
                        aliases: currency === 'CUP' ? [] : [currency.toLowerCase()],
                    }, {override: currenciesLoaded.value});
                });

            currenciesLoaded.value = true;
            lastLoadedAt.value = Date.now();
            document.dispatchEvent(new Event('currenciesLoaded'));
            editorStore.triggerCurrencyRefresh();
            return true;
        } catch (error) {
            console.warn('[currency] Failed to refresh currencies', error);
            return false;
        } finally {
            isLoading.value = false;
        }
    };

    const initCurrencySync = async (): Promise<void> => {
        if (initialized.value) {
            return;
        }

        initialized.value = true;

        await applyCurrencies();

        refreshTimer = window.setInterval(() => {
            void applyCurrencies();
        }, CURRENCY_REFRESH_INTERVAL);
    };

    return {
        initialized: readonly(initialized),
        currenciesLoaded: readonly(currenciesLoaded),
        isLoading: readonly(isLoading),
        lastLoadedAt: readonly(lastLoadedAt),
        initCurrencySync,
        refreshCurrencies: applyCurrencies,
    };
});
