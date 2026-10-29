/**
 * Manages the animation loop with controlled delta time and software-WebGL pacing safety.
 */
export class GameLoop {
  private frameId = 0;
  private isRunning = false;
  private lastTime = 0;
  private readonly onTick: (dt: number) => void;
  private readonly isSoftwareGl: boolean;
  private readonly getGlContext?: () => WebGL2RenderingContext | WebGLRenderingContext | null;

  constructor(
    onTick: (dt: number) => void,
    isSoftwareGl = false,
    getGlContext?: () => WebGL2RenderingContext | WebGLRenderingContext | null
  ) {
    this.onTick = onTick;
    this.isSoftwareGl = isSoftwareGl;
    this.getGlContext = getGlContext;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.scheduleNext();
  }

  public stop(): void {
    this.isRunning = false;
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      clearTimeout(this.frameId);
      this.frameId = 0;
    }
  }

  private scheduleNext(): void {
    if (!this.isRunning) return;
    if (this.isSoftwareGl && this.getGlContext) {
      const gl = this.getGlContext() as WebGL2RenderingContext | null;
      if (gl && typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (!this.isRunning) return;
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            this.frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            this.frameId = window.setTimeout(this.tick, 80);
          }
        };
        this.frameId = window.setTimeout(poll, 5);
        return;
      }
    }
    this.frameId = requestAnimationFrame(this.tick);
  }

  private readonly tick = (): void => {
    if (!this.isRunning) return;
    const now = performance.now();
    // Clamp delta to max 50ms so tab switches or hiccups never teleport entities
    const rawDt = (now - this.lastTime) / 1000;
    const dt = Math.min(0.05, Math.max(0.001, rawDt));
    this.lastTime = now;

    if (!document.hidden) {
      this.onTick(dt);
    }

    this.scheduleNext();
  };
}
