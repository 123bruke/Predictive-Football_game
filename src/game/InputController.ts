import { InputState } from '../types/game';

export class InputController {
  public state: InputState = {
    moveX: 0,
    moveY: 0,
    sprint: false,
    passPressed: false,
    passJustReleased: false,
    shootPressed: false,
    shootJustReleased: false,
    switchOrTackleJustPressed: false,
    pauseJustPressed: false,
    shootCharge: 0,
    passCharge: 0,
  };

  private keys = new Set<string>();
  private touchMoveX = 0;
  private touchMoveY = 0;
  private touchSprint = false;
  private isListening = false;

  private readonly handleKeyDown = (e: KeyboardEvent): void => {
    const code = e.code;
    // Prevent default scrolling or tab focus shifting during active gameplay
    if (
      code === 'Space' ||
      code === 'ArrowUp' ||
      code === 'ArrowDown' ||
      code === 'ArrowLeft' ||
      code === 'ArrowRight' ||
      code === 'Tab'
    ) {
      e.preventDefault();
    }

    if (this.keys.has(code)) return;
    this.keys.add(code);

    if (code === 'Space' || code === 'KeyK') {
      this.state.shootPressed = true;
    } else if (code === 'KeyX' || code === 'KeyJ' || code === 'Enter') {
      this.state.passPressed = true;
    } else if (code === 'Tab' || code === 'KeyC' || code === 'KeyQ') {
      this.state.switchOrTackleJustPressed = true;
    } else if (code === 'Escape' || code === 'KeyP') {
      this.state.pauseJustPressed = true;
    }
  };

  private readonly handleKeyUp = (e: KeyboardEvent): void => {
    const code = e.code;
    this.keys.delete(code);

    if (code === 'Space' || code === 'KeyK') {
      if (this.state.shootPressed) {
        this.state.shootPressed = false;
        this.state.shootJustReleased = true;
      }
    } else if (code === 'KeyX' || code === 'KeyJ' || code === 'Enter') {
      if (this.state.passPressed) {
        this.state.passPressed = false;
        this.state.passJustReleased = true;
      }
    }
  };

  private readonly handleBlur = (): void => {
    this.keys.clear();
    this.touchMoveX = 0;
    this.touchMoveY = 0;
    this.touchSprint = false;
    this.state.shootPressed = false;
    this.state.passPressed = false;
  };

  public attach(): void {
    if (this.isListening) return;
    window.addEventListener('keydown', this.handleKeyDown, { passive: false });
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
    this.isListening = true;
  }

  public detach(): void {
    if (!this.isListening) return;
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    this.keys.clear();
    this.isListening = false;
  }

  public setTouchJoystick(x: number, y: number): void {
    this.touchMoveX = Math.max(-1, Math.min(1, x));
    this.touchMoveY = Math.max(-1, Math.min(1, y));
  }

  public setTouchSprint(active: boolean): void {
    this.touchSprint = active;
  }

  public triggerTouchShootStart(): void {
    this.state.shootPressed = true;
  }

  public triggerTouchShootEnd(): void {
    if (this.state.shootPressed) {
      this.state.shootPressed = false;
      this.state.shootJustReleased = true;
    }
  }

  public triggerTouchPassStart(): void {
    this.state.passPressed = true;
  }

  public triggerTouchPassEnd(): void {
    if (this.state.passPressed) {
      this.state.passPressed = false;
      this.state.passJustReleased = true;
    }
  }

  public triggerTouchSwitchOrTackle(): void {
    this.state.switchOrTackleJustPressed = true;
  }

  public triggerPause(): void {
    this.state.pauseJustPressed = true;
  }

  public update(dt: number): void {
    let kx = 0;
    let ky = 0;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) kx += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) kx -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) ky += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) ky -= 1;

    if (kx !== 0 && ky !== 0) {
      const inv = 1 / Math.SQRT2;
      kx *= inv;
      ky *= inv;
    }

    // Combine keyboard and mobile touch joystick
    if (Math.abs(this.touchMoveX) > 0.05 || Math.abs(this.touchMoveY) > 0.05) {
      this.state.moveX = this.touchMoveX;
      this.state.moveY = this.touchMoveY;
    } else {
      this.state.moveX = kx;
      this.state.moveY = ky;
    }

    this.state.sprint =
      this.touchSprint ||
      this.keys.has('ShiftLeft') ||
      this.keys.has('ShiftRight');

    // Charge meters for shoot & pass
    if (this.state.shootPressed) {
      this.state.shootCharge = Math.min(1, this.state.shootCharge + dt * 1.85);
      if (this.state.shootCharge >= 1) {
        // Auto-release at full power so holding doesn't stall
        this.state.shootPressed = false;
        this.state.shootJustReleased = true;
      }
    }

    if (this.state.passPressed) {
      this.state.passCharge = Math.min(1, this.state.passCharge + dt * 2.2);
      if (this.state.passCharge >= 1) {
        this.state.passPressed = false;
        this.state.passJustReleased = true;
      }
    }
  }

  public consumeOneShotFlags(): void {
    if (this.state.shootJustReleased) {
      this.state.shootJustReleased = false;
      this.state.shootCharge = 0;
    }
    if (this.state.passJustReleased) {
      this.state.passJustReleased = false;
      this.state.passCharge = 0;
    }
    this.state.switchOrTackleJustPressed = false;
    this.state.pauseJustPressed = false;
  }
}
