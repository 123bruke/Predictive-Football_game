import { PitchConfig, RestartType, TeamId } from '../types/game';
import { Ball } from './Ball';
import { Team } from './Team';

export interface RuleCheckResult {
  event: 'NONE' | 'GOAL' | 'OUT_OF_BOUNDS';
  scoringTeam?: TeamId;
  restartType?: RestartType;
  restartTeam?: TeamId;
  restartX?: number;
  restartY?: number;
}

export class FootballRules {
  /**
   * Evaluates whether the ball has completely crossed a goal line (Goal / Goal Kick / Corner)
   * or a touchline (Throw-in).
   */
  public static checkBallBounds(ball: Ball, pitch: PitchConfig): RuleCheckResult {
    const b = ball.state;
    const halfGoalY = pitch.goalWidth * 0.5;

    // 1. Check right goal line (+halfW) -> Home attacks right (+X)
    if (b.x - b.radius > pitch.halfW) {
      if (Math.abs(b.y) < halfGoalY && b.z <= pitch.goalHeight) {
        return {
          event: 'GOAL',
          scoringTeam: 'home',
        };
      }
      // Missed right of goal line: Goal Kick for Away (if Home touched last) or Corner for Home (if Away touched last)
      const lastTouch = b.lastTouchTeam ?? 'home';
      if (lastTouch === 'home') {
        return {
          event: 'OUT_OF_BOUNDS',
          restartType: 'GOAL_KICK',
          restartTeam: 'away',
          restartX: pitch.halfW - pitch.goalAreaW + 0.5,
          restartY: 0,
        };
      } else {
        const cornerY = b.y >= 0 ? pitch.halfH - 0.8 : -pitch.halfH + 0.8;
        return {
          event: 'OUT_OF_BOUNDS',
          restartType: 'CORNER_KICK',
          restartTeam: 'home',
          restartX: pitch.halfW - 0.8,
          restartY: cornerY,
        };
      }
    }

    // 2. Check left goal line (-halfW) -> Away attacks left (-X)
    if (b.x + b.radius < -pitch.halfW) {
      if (Math.abs(b.y) < halfGoalY && b.z <= pitch.goalHeight) {
        return {
          event: 'GOAL',
          scoringTeam: 'away',
        };
      }
      const lastTouch = b.lastTouchTeam ?? 'away';
      if (lastTouch === 'away') {
        return {
          event: 'OUT_OF_BOUNDS',
          restartType: 'GOAL_KICK',
          restartTeam: 'home',
          restartX: -pitch.halfW + pitch.goalAreaW - 0.5,
          restartY: 0,
        };
      } else {
        const cornerY = b.y >= 0 ? pitch.halfH - 0.8 : -pitch.halfH + 0.8;
        return {
          event: 'OUT_OF_BOUNDS',
          restartType: 'CORNER_KICK',
          restartTeam: 'away',
          restartX: -pitch.halfW + 0.8,
          restartY: cornerY,
        };
      }
    }

    // 3. Check top/bottom touchlines (Throw-in)
    if (Math.abs(b.y) - b.radius > pitch.halfH) {
      const lastTouch = b.lastTouchTeam ?? 'home';
      const restartTeam: TeamId = lastTouch === 'home' ? 'away' : 'home';
      const clampedX = Math.max(-pitch.halfW + 2.5, Math.min(pitch.halfW - 2.5, b.x));
      const restartY = b.y > 0 ? pitch.halfH - 0.4 : -pitch.halfH + 0.4;
      return {
        event: 'OUT_OF_BOUNDS',
        restartType: 'THROW_IN',
        restartTeam,
        restartX: clampedX,
        restartY,
      };
    }

    return { event: 'NONE' };
  }

  /**
   * Positions the ball and both teams for a quick, readable arcade restart
   * (Throw-in, Goal Kick, or Corner Kick).
   */
  public static setupRestart(
    type: RestartType,
    restartTeam: TeamId,
    rx: number,
    ry: number,
    ball: Ball,
    homeTeam: Team,
    awayTeam: Team,
    pitch: PitchConfig
  ): string {
    ball.reset(rx, ry);

    const takingTeam = restartTeam === 'home' ? homeTeam : awayTeam;
    const defendingTeam = restartTeam === 'home' ? awayTeam : homeTeam;

    // Reset players near their tactical anchors shifted toward the restart spot
    const allTeams = [homeTeam, awayTeam];
    for (const team of allTeams) {
      for (const player of team.players) {
        const p = player.state;
        p.vx = 0;
        p.vy = 0;
        p.stunTimer = 0;
        p.actionTimer = 0;
        p.animState = 'idle';
        if (p.role === 'GK') {
          p.x = p.team === 'home' ? -pitch.halfW + 2.4 : pitch.halfW - 2.4;
          p.y = 0;
        } else {
          p.x = Math.max(-pitch.halfW + 3, Math.min(pitch.halfW - 3, p.anchorX + rx * 0.35));
          p.y = Math.max(-pitch.halfH + 2, Math.min(pitch.halfH - 2, p.anchorY + ry * 0.25));
        }
      }
    }

    // Choose taker on restartTeam
    let taker = takingTeam.players[3]; // Default midfielder
    if (type === 'GOAL_KICK') {
      taker = takingTeam.players[0]; // GK takes goal kick
    } else {
      // Closest non-GK to restart spot
      let bestDistSq = Infinity;
      for (let i = 1; i < takingTeam.players.length; i++) {
        const cand = takingTeam.players[i];
        const dx = cand.state.x - rx;
        const dy = cand.state.y - ry;
        const dSq = dx * dx + dy * dy;
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          taker = cand;
        }
      }
    }

    // Place taker at ball and give immediate possession so player/AI can pass or dribble
    taker.state.x = rx;
    taker.state.y = ry;
    taker.state.angle = Math.atan2(-ry, restartTeam === 'home' ? 8 : -8);
    ball.state.ownerId = taker.state.id;
    ball.state.lastTouchTeam = restartTeam;
    ball.state.lastTouchPlayerName = taker.state.name;
    ball.state.pickupCooldown = 0.25;

    // Push any defending player at least 6 units away from the restart spot
    for (const def of defendingTeam.players) {
      const dx = def.state.x - rx;
      const dy = def.state.y - ry;
      const dSq = dx * dx + dy * dy;
      if (dSq < 36) {
        const dist = Math.max(0.1, Math.sqrt(dSq));
        def.state.x = rx + (dx / dist) * 6.5;
        def.state.y = Math.max(-pitch.halfH + 1.5, Math.min(pitch.halfH - 1.5, ry + (dy / dist) * 6.5));
      }
    }

    return taker.state.id;
  }
}
