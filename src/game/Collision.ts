import { PitchConfig } from '../types/game';
import { Ball } from './Ball';
import { Player } from './Player';

export class Collision {
  /**
   * Resolves player-to-player overlaps in O(n^2) for the fixed 10-player roster
   * using squared-distance checks first to avoid unnecessary sqrt calls.
   */
  public static resolvePlayerCollisions(players: Player[]): void {
    const count = players.length;
    for (let i = 0; i < count; i++) {
      const a = players[i].state;
      for (let j = i + 1; j < count; j++) {
        const b = players[j].state;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const minDist = a.radius + b.radius;
        const minDistSq = minDist * minDist;
        const dSq = dx * dx + dy * dy;

        if (dSq < minDistSq && dSq > 0.00001) {
          const dist = Math.sqrt(dSq);
          const overlap = (minDist - dist) * 0.5;
          const nx = dx / dist;
          const ny = dy / dist;

          a.x -= nx * overlap;
          a.y -= ny * overlap;
          b.x += nx * overlap;
          b.y += ny * overlap;

          // Dampen relative velocity along collision normal
          const rvx = b.vx - a.vx;
          const rvy = b.vy - a.vy;
          const relDot = rvx * nx + rvy * ny;
          if (relDot < 0) {
            const impulse = relDot * 0.35;
            a.vx += nx * impulse;
            a.vy += ny * impulse;
            b.vx -= nx * impulse;
            b.vy -= ny * impulse;
          }
        }
      }
    }
  }

  /**
   * Handles ball possession, dribbling attachment, tackles, and goalkeeper interceptions.
   * Returns true if a tackle/interception or pickup occurred.
   */
  public static handleBallPlayerInteractions(
    ball: Ball,
    players: Player[],
    pitch: PitchConfig,
    onStealOrPickup?: (player: Player, wasTackle: boolean) => void
  ): void {
    const b = ball.state;

    // 1. If ball currently has an owner, keep it attached slightly ahead of their feet
    let currentOwner: Player | null = null;
    if (b.ownerId) {
      for (let i = 0; i < players.length; i++) {
        if (players[i].state.id === b.ownerId) {
          currentOwner = players[i];
          break;
        }
      }
      if (currentOwner && currentOwner.state.stunTimer <= 0) {
        const p = currentOwner.state;
        const dribbleOffset = p.radius + b.radius * 0.65;
        const strideBob = Math.sin(p.animPhase * 1.5) * 0.12;
        b.x = p.x + Math.cos(p.angle) * (dribbleOffset + strideBob);
        b.y = p.y + Math.sin(p.angle) * (dribbleOffset + strideBob);
        b.z = 0;
        b.vx = p.vx;
        b.vy = p.vy;
        b.vz = 0;
        b.lastTouchTeam = p.team;
        b.lastTouchPlayerName = p.name;

        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        b.spinAngle = (b.spinAngle + speed * 0.03) % (Math.PI * 2);
      } else {
        b.ownerId = null;
      }
    }

    if (b.pickupCooldown > 0) return;

    // 2. Check if an opposing player can tackle/steal or if a player picks up a loose ball
    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      const p = player.state;
      if (p.stunTimer > 0) continue;
      if (currentOwner && p.id === currentOwner.state.id) continue;

      const isGK = p.role === 'GK';
      const inOwnPenalty =
        isGK &&
        Math.abs(p.y) < pitch.penaltyAreaH * 0.5 &&
        (p.team === 'home'
          ? p.x < -pitch.halfW + pitch.penaltyAreaW
          : p.x > pitch.halfW - pitch.penaltyAreaW);

      const maxReachHeight = inOwnPenalty ? 2.4 : 1.35;
      if (b.z > maxReachHeight) continue;

      const isTackling = p.animState === 'tackle' && p.actionTimer > 0;
      const reachRadius = p.radius + b.radius + (isTackling ? 0.85 : inOwnPenalty ? 0.55 : 0.25);
      const reachSq = reachRadius * reachRadius;

      const dx = b.x - p.x;
      const dy = b.y - p.y;
      const dSq = dx * dx + dy * dy;

      if (dSq <= reachSq) {
        if (!currentOwner) {
          // Loose ball pickup or GK block
          const ballSpeedSq = b.vx * b.vx + b.vy * b.vy;
          if (ballSpeedSq > 650 && !inOwnPenalty && !isTackling) {
            // Very hard shot deflects off outfield player
            const dist = Math.max(0.1, Math.sqrt(dSq));
            const nx = dx / dist;
            const ny = dy / dist;
            b.vx = nx * 14;
            b.vy = ny * 14;
            b.pickupCooldown = 0.14;
            b.lastTouchTeam = p.team;
            b.lastTouchPlayerName = p.name;
            ball.spawnImpact(b.x, b.y, b.z, 2.2, '#e2e8f0');
            return;
          }

          b.ownerId = p.id;
          b.lastTouchTeam = p.team;
          b.lastTouchPlayerName = p.name;
          b.z = 0;
          b.vz = 0;
          b.pickupCooldown = 0.18;
          if (onStealOrPickup) onStealOrPickup(player, false);
          return;
        } else if (currentOwner.state.team !== p.team) {
          // Contesting possession from opponent
          const stealChance = isTackling ? 0.92 : inOwnPenalty ? 0.88 : 0.42;
          if (Math.random() < stealChance) {
            currentOwner.state.stunTimer = isTackling ? 0.55 : 0.32;
            currentOwner.state.vx *= 0.25;
            currentOwner.state.vy *= 0.25;
            b.ownerId = p.id;
            b.lastTouchTeam = p.team;
            b.lastTouchPlayerName = p.name;
            b.pickupCooldown = 0.28;
            ball.spawnImpact(b.x, b.y, 0, 2.6, '#38bdf8');
            if (onStealOrPickup) onStealOrPickup(player, true);
            return;
          }
        }
      }
    }
  }
}
