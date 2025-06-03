import * as wails from '@wailsio/runtime'

// 窗口控制工具类
export class WindowController {
    private static instance: WindowController;
    private currentWindow = wails.Window;
    private isWindowVisible: boolean = true; // 跟踪窗口可见状态
    private isInitialized: boolean = false; // 跟踪是否已初始化
    private isToggling: boolean = false; // 防止重复切换
    private lastToggleTime: number = 0; // 上次切换时间
    private readonly TOGGLE_COOLDOWN = 500; // 切换冷却时间（毫秒）

    static getInstance(): WindowController {
        if (!WindowController.instance) {
            WindowController.instance = new WindowController();
        }
        return WindowController.instance;
    }

    async toggleWindow(): Promise<void> {
        const now = Date.now();

        // 防抖检查
        if (this.isToggling || (now - this.lastToggleTime) < this.TOGGLE_COOLDOWN) {
            return;
        }

        this.isToggling = true;
        this.lastToggleTime = now;

        try {
            // 如果还没初始化，先初始化状态
            if (!this.isInitialized) {
                await this.syncWindowState();
            }

            if (!this.isWindowVisible) {
                // 窗口当前隐藏，显示它
                await this.currentWindow.Show();
                await this.currentWindow.UnMinimise(); // 修正API名称
                await this.currentWindow.Focus();
                this.isWindowVisible = true;
            } else {
                // 窗口当前可见，隐藏它
                await this.currentWindow.Hide();
                this.isWindowVisible = false;
            }
        } catch (error) {
            console.error(error);
        } finally {
            // 延迟重置切换状态，确保操作完成
            setTimeout(() => {
                this.isToggling = false;
            }, 100);
        }
    }

    // 同步窗口状态
    private async syncWindowState(): Promise<void> {
        try {
            // 检查窗口是否最小化
            const isMinimised = await this.currentWindow.IsMinimised();

            // 简化状态判断：只要不是最小化状态就认为是可见的
            this.isWindowVisible = !isMinimised;

            this.isInitialized = true;
        } catch (error) {
            // 如果检查失败，保持默认状态
            this.isWindowVisible = true;
            this.isInitialized = true;
        }
    }

    // 当窗口被系统事件隐藏时调用（比如点击关闭/最小化按钮）
    onWindowHidden(): void {
        this.isWindowVisible = false;
    }

    // 当窗口被系统事件显示时调用（比如点击托盘图标）
    onWindowShown(): void {
        this.isWindowVisible = true;
    }

    async initializeHotkeyListener(): Promise<void> {
        // 初始化时同步窗口状态
        await this.syncWindowState();

        // 监听后端发送的热键事件
        wails.Events.On('hotkey:toggle-window', () => {
            this.toggleWindow();
        });

        // 监听窗口显示/隐藏事件以同步状态
        wails.Events.On('window:shown', () => {
            this.onWindowShown();
        });

        wails.Events.On('window:hidden', () => {
            this.onWindowHidden();
        });


    }
}