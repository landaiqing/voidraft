import { Extension } from '@codemirror/state';
import { EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';
import './styles.css';

// 粒子接口定义
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  size: number;
  color: number[];
  theta?: number;
  drag?: number;
  wander?: number;
}

// 配置接口
interface CodeBlastConfig {
  effect?: 1 | 2; //  effect 1: 随机粒子， effect 2: 追逐粒子
  shake?: boolean;  // 启用震动效果
  maxParticles?: number;  // 最大粒子数
  particleRange?: { min: number; max: number };  // 粒子大小范围
  shakeIntensity?: number;  // 震动强度
  gravity?: number;  // 重力加速度 (仅 effect: 1)
  alphaFadeout?: number; // 粒子透明度衰减
  velocityRange?: { // 粒子速度范围
    x: [number, number]; // x轴方向速度范围
    y: [number, number];  // y轴方向速度范围
  };
}

class CodeBlastEffect {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private particles: Particle[] = [];
  private particlePointer = 0;
  private isActive = false;
  private lastTime = 0;
  private shakeTime = 0;
  private shakeTimeMax = 0;
  private animationId: number | null = null;

  // 配置参数
  private config: Required<CodeBlastConfig> = {
    effect: 2,
    shake: true,
    maxParticles: 500,
    particleRange: { min: 5, max: 10 },
    shakeIntensity: 5,
    gravity: 0.08,
    alphaFadeout: 0.96,
    velocityRange: {
      x: [-1, 1],
      y: [-3.5, -1.5]
    }
  };

  constructor(config?: CodeBlastConfig) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    this.particles = new Array(this.config.maxParticles);
  }

  private getRGBComponents(element: Element): number[] {
    try {
      const style = getComputedStyle(element);
      const color = style.color;
      if (color) {
        const match = color.match(/(\d+),\s*(\d+),\s*(\d+)/);
        if (match) {
          return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
        }
      }
    } catch (e) {
      console.warn('Failed to get RGB components:', e);
    }
    return [255, 255, 255]; // 默认白色
  }

  private random(min: number, max?: number): number {
    if (max === undefined) {
      max = min;
      min = 0;
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  private createParticle(x: number, y: number, color: number[]): Particle {
    const particle: Particle = {
      x,
      y: y + 10,
      alpha: 1,
      color,
      vx: 0,
      vy: 0,
      size: 0
    };

    if (this.config.effect === 1) {
      particle.size = this.random(2, 4);
      particle.vx = this.config.velocityRange.x[0] + 
        Math.random() * (this.config.velocityRange.x[1] - this.config.velocityRange.x[0]);
      particle.vy = this.config.velocityRange.y[0] + 
        Math.random() * (this.config.velocityRange.y[1] - this.config.velocityRange.y[0]);
    } else if (this.config.effect === 2) {
      particle.size = this.random(2, 8);
      particle.drag = 0.92;
      particle.vx = this.random(-3, 3);
      particle.vy = this.random(-3, 3);
      particle.wander = 0.15;
      particle.theta = this.random(0, 360) * Math.PI / 180;
    }

    return particle;
  }

  private spawnParticles(view: EditorView): void {
    if (!this.ctx) return;

    try {
      // 获取光标位置
      const selection = view.state.selection.main;
      const coords = view.coordsAtPos(selection.head);
      if (!coords) return;

    // 获取光标处的元素来确定颜色
    const element = document.elementFromPoint(coords.left, coords.top);
    const color = element ? this.getRGBComponents(element) : [255, 255, 255];

    const numParticles = this.random(
      this.config.particleRange.min, 
      this.config.particleRange.max
    );

    for (let i = 0; i < numParticles; i++) {
      this.particles[this.particlePointer] = this.createParticle(
        coords.left + 10, 
        coords.top, 
        color
      );
      this.particlePointer = (this.particlePointer + 1) % this.config.maxParticles;
    }
    } catch (error) {
      // 如果在更新期间无法读取坐标，静默忽略
      console.warn('Failed to spawn particles:', error);
    }
  }

  private effect1(particle: Particle): void {
    if (!this.ctx) return;

    particle.vy += this.config.gravity;
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.alpha *= this.config.alphaFadeout;

    this.ctx.fillStyle = `rgba(${particle.color[0]}, ${particle.color[1]}, ${particle.color[2]}, ${particle.alpha})`;
    this.ctx.fillRect(
      Math.round(particle.x - 1), 
      Math.round(particle.y - 1), 
      particle.size, 
      particle.size
    );
  }

  private effect2(particle: Particle): void {
    if (!this.ctx || particle.theta === undefined || particle.drag === undefined) return;

    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.vx *= particle.drag;
    particle.vy *= particle.drag;
    particle.theta += this.random(-0.5, 0.5);
    particle.vx += Math.sin(particle.theta) * 0.1;
    particle.vy += Math.cos(particle.theta) * 0.1;
    particle.size *= 0.96;

    this.ctx.fillStyle = `rgba(${particle.color[0]}, ${particle.color[1]}, ${particle.color[2]}, ${particle.alpha})`;
    this.ctx.beginPath();
    this.ctx.arc(
      Math.round(particle.x - 1), 
      Math.round(particle.y - 1), 
      particle.size, 
      0, 
      2 * Math.PI
    );
    this.ctx.fill();
  }

  private drawParticles(): void {
    if (!this.ctx) return;

    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      if (!particle || particle.alpha < 0.01 || particle.size <= 0.5) {
        continue;
      }

      if (this.config.effect === 1) {
        this.effect1(particle);
      } else if (this.config.effect === 2) {
        this.effect2(particle);
      }
    }
  }

  private shake(view: EditorView, duration: number): void {
    if (!this.config.shake) return;

    this.shakeTime = this.shakeTimeMax = duration;
    const editorElement = view.dom;
    
    const shakeAnimation = () => {
      if (this.shakeTime <= 0) {
        editorElement.style.transform = '';
        return;
      }

      const magnitude = (this.shakeTime / this.shakeTimeMax) * this.config.shakeIntensity;
      const shakeX = this.random(-magnitude, magnitude);
      const shakeY = this.random(-magnitude, magnitude);
      editorElement.style.transform = `translate(${shakeX}px, ${shakeY}px)`;
      
      this.shakeTime -= 0.016; // ~60fps
      requestAnimationFrame(shakeAnimation);
    };

    requestAnimationFrame(shakeAnimation);
  }

  private loop = (): void => {
    if (!this.isActive || !this.ctx || !this.canvas) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawParticles();
    this.animationId = requestAnimationFrame(this.loop);
  };

  public init(view: EditorView): void {
    if (this.isActive) return;

    this.isActive = true;

    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d');
      
      if (!this.ctx) {
        console.error('Failed to get canvas context');
        return;
      }

      this.canvas.id = 'code-blast-canvas';
      this.canvas.style.position = 'absolute';
      this.canvas.style.top = '0';
      this.canvas.style.left = '0';
      this.canvas.style.zIndex = '1';
      this.canvas.style.pointerEvents = 'none';
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;

      document.body.appendChild(this.canvas);
      this.loop();
    }
  }

  public destroy(): void {
    this.isActive = false;
    
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    if (this.canvas) {
      this.canvas.remove();
      this.canvas = null;
      this.ctx = null;
    }
  }

  public onDocumentChange(view: EditorView): void {
    if (this.config.shake) {
      this.shake(view, 0.3);
    }
    // 使用 requestIdleCallback 或 setTimeout 延迟执行粒子生成
    // 确保在 DOM 更新完成后再读取坐标
    if (window.requestIdleCallback) {
      window.requestIdleCallback(() => {
        this.spawnParticles(view);
      });
    } else {
      setTimeout(() => {
        this.spawnParticles(view);
      }, 16); // ~60fps
    }
  }

  public updateCanvasSize(): void {
    if (this.canvas) {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    }
  }
}

// 节流函数
function throttle<T extends (...args: any[]) => void>(
  func: T, 
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return function(this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// 创建 CodeBlast 扩展
export function createCodeBlastExtension(config?: CodeBlastConfig): Extension {
  let effect: CodeBlastEffect | null = null;

  const plugin = ViewPlugin.fromClass(class {
    private throttledOnChange: (view: EditorView) => void;

    constructor(private view: EditorView) {
      effect = new CodeBlastEffect(config);
      effect.init(view);
      
      this.throttledOnChange = throttle((view: EditorView) => {
        effect?.onDocumentChange(view);
      }, 100);

      // 监听窗口大小变化
      window.addEventListener('resize', this.handleResize);
    }

    update(update: ViewUpdate) {
      if (update.docChanged) {
        // 延迟执行，确保更新完成后再触发效果
        setTimeout(() => {
          this.throttledOnChange(this.view);
        }, 0);
      }
    }

    destroy() {
      effect?.destroy();
      effect = null;
      window.removeEventListener('resize', this.handleResize);
    }

    private handleResize = () => {
      effect?.updateCanvasSize();
    };
  });

  return plugin;
}

// 默认导出
export const codeBlast = createCodeBlastExtension(); 