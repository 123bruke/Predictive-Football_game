import { PitchConfig, PlayerRole, PlayerState, TeamId } from '../types/game';

export class Player {
  public state: PlayerState;

  constructor(config: {
    id: string;
    team: TeamId;
    number: number;
    name: string;
    role: PlayerRole;
    anchorX: number;
    anchorY: number;
    kickoffX: number;
    kickoffY: number;
    skinTone: string;
    hairColor: string;
  }) {
    const isGK = config.role === 'GK';
    const isFWD = config.role === 'FWD';

    this.state = {
      id: config.id,
      team: config.team,
      number: config.number,
      name: config.name,
      role: config.role,
      x: config.kickoffX,
      y: config.kickoffY,
      vx: 0,
      vy: 0,
      angle: config.team === 'home' ? 0 : Math.PI,
      anchorX: config.anchorX,
      anchorY: config.anchorY,
      kickoffX: config.kickoffX,
      kickoffY: config.kickoffY,
      maxSpeed: isGK ? 14.2 : isFWD ? 17.2 : 16.4,
      accel: isGK ? 62 : 70,
      stamina: 100,
      maxStamina: 100,
      radius: 1.05,
      animState: 'idle',
      animPhase: Math.random() * Math.PI * 2,
      actionTimer: 0,
      tackleCooldown: 0,
      stunTimer: 0,
      skinTone: config.skinTone,
      hairColor: config.hairColor,
    };
  }

  public resetToKickoff(hasKickoffPossession: boolean, isFirstForward: boolean): void {
    const p = this.state;
    if (hasKickoffPossession && isFirstForward) {
      p.x = p.team === 'home' ? -1.4 : 1.4;
      p.y = 0;
    } else {
      p.x = p.kickoffX;
      p.y = p.kickoffY;
    }
    p.vx = 0;
    p.vy = 0;
    p.angle = p.team === 'home' ? 0 : Math.PI;
    p.animState = 'idle';
    p.actionTimer = 0;
    p.tackleCooldown = 0;
    p.stunTimer = 0;
  }

  public applyMovement(
    dirX: number,
    dirY: number,
    wantsSprint: boolean,
    hasBall: boolean,
    dt: number,
    pitch: PitchConfig
  ): void {
    const p = this.state;

    if (p.tackleCooldown > 0) p.tackleCooldown = Math.max(0, p.tackleCooldown - dt);
    if (p.stunTimer > 0) {
      p.stunTimer = Math.max(0, p.stunTimer - dt);
      p.vx *= Math.pow(0.84, dt * 60);
      p.vy *= Math.pow(0.84, dt * 60);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      return;
    }

    if (p.actionTimer > 0) {
      p.actionTimer = Math.max(0, p.actionTimer - dt);
    }

    const lenSq = dirX * dirX + dirY * dirY;
    let nx = 0;
    let ny = 0;
    let inputMag = 0;

    if (lenSq > 0.001) {
      inputMag = Math.min(1, Math.sqrt(lenSq));
      const invLen = 1 / Math.sqrt(lenSq);
      nx = dirX * invLen;
      ny = dirY * invLen;
    }

    // Stamina management
    const canSprint = wantsSprint && p.stamina > 8 && inputMag > 0.25;
    if (canSprint) {
      p.stamina = Math.max(0, p.stamina - 18 * dt);
    } else {
      p.stamina = Math.min(p.maxStamina, p.stamina + (inputMag < 0.1 ? 16 : 9) * dt);
    }

    const staminaFactor = p.stamina < 20 ? 0.84 : 1.0;
    const sprintMult = canSprint ? 1.28 : 1.0;
    const dribbleMult = hasBall ? 0.91 : 1.0;

    // Lunge boost during active slide/standing tackle
    const isTackling = p.animState === 'tackle' && p.actionTimer > 0;
    const topSpeed = p.maxSpeed * staminaFactor * sprintMult * dribbleMult * (isTackling ? 1.18 : 1.0);

    if (isTackling) {
      // Slide / lunge forward along facing angle
      p.vx *= Math.pow(0.92, dt * 60);
      p.vy *= Math.pow(0.92, dt * 60);
    } else if (inputMag > 0.05) {
      const targetVx = nx * topSpeed * inputMag;
      const targetVy = ny * topSpeed * inputMag;
      const blend = Math.min(1, p.accel * dt * 0.14);
      p.vx += (targetVx - p.vx) * blend;
      p.vy += (targetVy - p.vy) * blend;

      // Smoothly rotate facing angle toward movement direction
      const targetAngle = Math.atan2(ny, nx);
      let diff = targetAngle - p.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      p.angle += diff * Math.min(1, dt * 14);
    } else {
      const stopDamp = Math.pow(0.8, dt * 60);
      p.vx *= stopDamp;
      p.vy *= stopDamp;
      if (p.vx * p.vx + p.vy * p.vy < 0.05) {
        p.vx = 0;
        p.vy = 0;
      }
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // Keep players inside stadium turf margin
    const marginX = pitch.halfW + 3.2;
    const marginY = pitch.halfH + 2.6;
    if (p.x < -marginX) {
      p.x = -marginX;
      p.vx = 0;
    } else if (p.x > marginX) {
      p.x = marginX;
      p.vx = 0;
    }
    if (p.y < -marginY) {
      p.y = -marginY;
      p.vy = 0;
    } else if (p.y > marginY) {
      p.y = marginY;
      p.vy = 0;
    }

    // Update animation state & stride cycle
    const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    if (p.actionTimer <= 0) {
      if (speed < 0.6) {
        p.animState = 'idle';
        p.animPhase += dt * 2.2;
      } else if (canSprint && speed > p.maxSpeed * 0.95) {
        p.animState = 'sprint';
        p.animPhase += dt * speed * 0.95;
      } else if (speed > 6.5) {
        p.animState = 'run';
        p.animPhase += dt * speed * 0.85;
      } else {
        p.animState = 'walk';
        p.animPhase += dt * speed * 0.75;
      }
    } else {
      p.animPhase += dt * 10;
    }
  }

  public triggerAction(anim: 'pass' | 'shoot' | 'tackle' | 'celebrate', duration: number): void {
    const p = this.state;
    p.animState = anim;
    p.actionTimer = duration;
    if (anim === 'tackle') {
      p.tackleCooldown = 0.85;
      p.vx = Math.cos(p.angle) * p.maxSpeed * 1.22;
      p.vy = Math.sin(p.angle) * p.maxSpeed * 1.22;
    }
  }
}
