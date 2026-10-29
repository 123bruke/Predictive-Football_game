import { BallState, ImpactEffect, PitchConfig, TeamId } from '../types/game';

const TRAIL_CAPACITY = 10;

export class Ball {
  public state: BallState;
  public impacts: ImpactEffect[];

  constructor() {
    const trail = [];
    for (let i = 0; i < TRAIL_CAPACITY; i++) {
      trail.push({ x: 0, y: 0, z: 0, alpha: 0 });
    }

    this.state = {
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      radius: 0.72,
      spinAngle: 0,
      spinSpeed: 0,
      ownerId: null,
      lastTouchTeam: null,
      lastTouchPlayerName: null,
      pickupCooldown: 0,
      trail,
    };

    // Pre-allocate reusable pool of lightweight impact rings (zero GC in loop)
    this.impacts = [];
    for (let i = 0; i < 6; i++) {
      this.impacts.push({
        active: false,
        x: 0,
        y: 0,
        z: 0,
        radius: 0.5,
        maxRadius: 3.2,
        alpha: 0,
        color: '#ffffff',
      });
    }
  }

  public reset(x = 0, y = 0): void {
    const b = this.state;
    b.x = x;
    b.y = y;
    b.z = 0;
    b.vx = 0;
    b.vy = 0;
    b.vz = 0;
    b.spinAngle = 0;
    b.spinSpeed = 0;
    b.ownerId = null;
    b.pickupCooldown = 0;
    for (let i = 0; i < b.trail.length; i++) {
      b.trail[i].x = x;
      b.trail[i].y = y;
      b.trail[i].z = 0;
      b.trail[i].alpha = 0;
    }
  }

  public spawnImpact(x: number, y: number, z: number, maxRadius = 2.8, color = '#ffffff'): void {
    for (let i = 0; i < this.impacts.length; i++) {
      const imp = this.impacts[i];
      if (!imp.active) {
        imp.active = true;
        imp.x = x;
        imp.y = y;
        imp.z = z;
        imp.radius = 0.35;
        imp.maxRadius = maxRadius;
        imp.alpha = 0.85;
        imp.color = color;
        return;
      }
    }
  }

  public kick(
    dirX: number,
    dirY: number,
    speed: number,
    loftVz: number,
    team: TeamId,
    playerName: string,
    impactColor = '#f8fafc'
  ): void {
    const b = this.state;
    const lenSq = dirX * dirX + dirY * dirY;
    let nx = 1;
    let ny = 0;
    if (lenSq > 0.0001) {
      const invLen = 1 / Math.sqrt(lenSq);
      nx = dirX * invLen;
      ny = dirY * invLen;
    }
    b.ownerId = null;
    b.vx = nx * speed;
    b.vy = ny * speed;
    b.vz = loftVz;
    b.spinSpeed = speed * 0.65;
    b.lastTouchTeam = team;
    b.lastTouchPlayerName = playerName;
    b.pickupCooldown = 0.16;
    this.spawnImpact(b.x, b.y, b.z, speed > 26 ? 3.4 : 2.2, impactColor);
  }

  public update(dt: number, pitch: PitchConfig): void {
    const b = this.state;

    if (b.pickupCooldown > 0) {
      b.pickupCooldown = Math.max(0, b.pickupCooldown - dt);
    }

    // Update impact rings
    for (let i = 0; i < this.impacts.length; i++) {
      const imp = this.impacts[i];
      if (imp.active) {
        imp.radius += (imp.maxRadius - imp.radius) * Math.min(1, dt * 10);
        imp.alpha -= dt * 2.6;
        if (imp.alpha <= 0.02) {
          imp.active = false;
        }
      }
    }

    // Only advance free physics if not currently dribbled by a player
    if (!b.ownerId) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // Vertical bounce & gravity
      if (b.z > 0 || b.vz !== 0) {
        b.z += b.vz * dt;
        b.vz -= 28 * dt; // Gravity
        if (b.z <= 0) {
          b.z = 0;
          if (Math.abs(b.vz) > 2.4) {
            b.vz = -b.vz * 0.48;
            b.vx *= 0.88;
            b.vy *= 0.88;
            this.spawnImpact(b.x, b.y, 0, 1.4, '#cbd5e1');
          } else {
            b.vz = 0;
          }
        }
      }

      // Grass drag (less drag when airborne)
      const friction = b.z > 0.15 ? 0.992 : 0.968;
      const damp = Math.pow(friction, dt * 60);
      b.vx *= damp;
      b.vy *= damp;

      const speedSq = b.vx * b.vx + b.vy * b.vy;
      if (speedSq < 0.04 && b.z === 0) {
        b.vx = 0;
        b.vy = 0;
        b.spinSpeed = 0;
      } else {
        const speed = Math.sqrt(speedSq);
        b.spinSpeed = speed * 1.1;
        b.spinAngle = (b.spinAngle + b.spinSpeed * dt) % (Math.PI * 2);
      }

      // Goalpost and goal net collisions
      this.handleGoalpostAndNetCollisions(pitch);
    }

    // Shift trail points without array allocations
    const speedSq = b.vx * b.vx + b.vy * b.vy;
    for (let i = b.trail.length - 1; i > 0; i--) {
      b.trail[i].x = b.trail[i - 1].x;
      b.trail[i].y = b.trail[i - 1].y;
      b.trail[i].z = b.trail[i - 1].z;
      b.trail[i].alpha = b.trail[i - 1].alpha * 0.82;
    }
    b.trail[0].x = b.x;
    b.trail[0].y = b.y;
    b.trail[0].z = b.z;
    b.trail[0].alpha = speedSq > 140 ? Math.min(0.65, (speedSq - 140) / 500) : 0;
  }

  private handleGoalpostAndNetCollisions(pitch: PitchConfig): void {
    const b = this.state;
    const halfGoalY = pitch.goalWidth * 0.5;
    const postRadius = 0.22;
    const minDist = b.radius + postRadius;
    const minDistSq = minDist * minDist;

    // 4 goalposts: (-halfW, -halfGoalY), (-halfW, +halfGoalY), (+halfW, -halfGoalY), (+halfW, +halfGoalY)
    const postsX = [-pitch.halfW, -pitch.halfW, pitch.halfW, pitch.halfW];
    const postsY = [-halfGoalY, halfGoalY, -halfGoalY, halfGoalY];

    for (let i = 0; i < 4; i++) {
      const dx = b.x - postsX[i];
      const dy = b.y - postsY[i];
      const dSq = dx * dx + dy * dy;
      if (dSq < minDistSq && dSq > 0.00001 && b.z <= pitch.goalHeight + 0.3) {
        const dist = Math.sqrt(dSq);
        const nx = dx / dist;
        const ny = dy / dist;
        b.x = postsX[i] + nx * minDist;
        b.y = postsY[i] + ny * minDist;
        const dot = b.vx * nx + b.vy * ny;
        if (dot < 0) {
          b.vx = (b.vx - 1.85 * dot * nx) * 0.78;
          b.vy = (b.vy - 1.85 * dot * ny) * 0.78;
          this.spawnImpact(postsX[i], postsY[i], b.z, 2.8, '#fbbf24');
        }
      }
    }

    // Back and side nets when ball is inside the goal mouth depth
    if (Math.abs(b.x) > pitch.halfW && Math.abs(b.y) <= halfGoalY + 0.4) {
      const maxDepthX = pitch.halfW + pitch.goalDepth - b.radius;
      if (b.x > maxDepthX) {
        b.x = maxDepthX;
        b.vx = -Math.abs(b.vx) * 0.22;
        b.vy *= 0.4;
      } else if (b.x < -maxDepthX) {
        b.x = -maxDepthX;
        b.vx = Math.abs(b.vx) * 0.22;
        b.vy *= 0.4;
      }
      if (b.y > halfGoalY - b.radius) {
        b.y = halfGoalY - b.radius;
        b.vy = -Math.abs(b.vy) * 0.25;
      } else if (b.y < -halfGoalY + b.radius) {
        b.y = -halfGoalY + b.radius;
        b.vy = Math.abs(b.vy) * 0.25;
      }
    }
  }
}
