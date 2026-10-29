import { DifficultyLevel, PitchConfig } from '../types/game';
import { Ball } from './Ball';
import { Player } from './Player';
import { Team } from './Team';

export class OpponentAI {
  private aiDecisionCooldown = 0;

  /**
   * Updates AI movement and decisions for all non-human-controlled players on both teams.
   */
  public update(
    dt: number,
    homeTeam: Team,
    awayTeam: Team,
    controlledPlayerId: string,
    ball: Ball,
    pitch: PitchConfig,
    difficulty: DifficultyLevel,
    onSoundEvent?: (type: 'pass' | 'shoot' | 'tackle') => void
  ): void {
    if (this.aiDecisionCooldown > 0) {
      this.aiDecisionCooldown = Math.max(0, this.aiDecisionCooldown - dt);
    }

    const diffMultiplier = difficulty === 'pro' ? 1.06 : difficulty === 'standard' ? 0.96 : 0.85;

    // 1. Update Home Team non-controlled teammates
    this.updateTeamAI(
      dt,
      homeTeam,
      awayTeam,
      controlledPlayerId,
      ball,
      pitch,
      0.95,
      onSoundEvent
    );

    // 2. Update Away Team (full AI opponent)
    this.updateTeamAI(
      dt,
      awayTeam,
      homeTeam,
      controlledPlayerId,
      ball,
      pitch,
      diffMultiplier,
      onSoundEvent
    );
  }

  private updateTeamAI(
    dt: number,
    myTeam: Team,
    oppTeam: Team,
    controlledPlayerId: string,
    ball: Ball,
    pitch: PitchConfig,
    skillScale: number,
    onSoundEvent?: (type: 'pass' | 'shoot' | 'tackle') => void
  ): void {
    const b = ball.state;
    const attackDir = myTeam.id === 'home' ? 1 : -1;
    const targetGoalX = attackDir * pitch.halfW;
    const ownGoalX = -attackDir * pitch.halfW;

    // Determine who on myTeam is closest to the ball (excluding GK)
    let closestChaserId = '';
    let closestDistSq = Infinity;
    for (let i = 0; i < myTeam.players.length; i++) {
      const p = myTeam.players[i].state;
      if (p.role === 'GK') continue;
      const dx = b.x - p.x;
      const dy = b.y - p.y;
      const dSq = dx * dx + dy * dy;
      if (dSq < closestDistSq) {
        closestDistSq = dSq;
        closestChaserId = p.id;
      }
    }

    const teamHasBall =
      b.ownerId !== null && b.ownerId.startsWith(myTeam.id);

    for (let i = 0; i < myTeam.players.length; i++) {
      const player = myTeam.players[i];
      const p = player.state;

      // Skip human-controlled player
      if (p.id === controlledPlayerId) continue;

      const hasBall = b.ownerId === p.id;

      if (p.role === 'GK') {
        this.updateGoalkeeper(
          dt,
          player,
          myTeam,
          oppTeam,
          ball,
          pitch,
          hasBall,
          ownGoalX,
          attackDir,
          onSoundEvent
        );
        continue;
      }

      if (hasBall) {
        // AI player currently has possession of the ball
        this.updateBallCarrier(
          dt,
          player,
          myTeam,
          oppTeam,
          ball,
          pitch,
          targetGoalX,
          attackDir,
          skillScale,
          onSoundEvent
        );
      } else if (!teamHasBall && p.id === closestChaserId) {
        // Primary presser chases the ball or opponent ball carrier
        const leadX = b.x + b.vx * 0.18;
        const leadY = b.y + b.vy * 0.18;
        const dx = leadX - p.x;
        const dy = leadY - p.y;
        const distSq = dx * dx + dy * dy;

        // Trigger standing tackle if close to opponent ball carrier
        if (
          b.ownerId &&
          !b.ownerId.startsWith(myTeam.id) &&
          distSq < 6.2 &&
          p.tackleCooldown <= 0 &&
          this.aiDecisionCooldown <= 0
        ) {
          p.angle = Math.atan2(dy, dx);
          player.triggerAction('tackle', 0.28);
          this.aiDecisionCooldown = 0.35;
          if (onSoundEvent) onSoundEvent('tackle');
        }

        const wantsSprint = distSq > 25 && p.stamina > 30;
        player.applyMovement(dx * skillScale, dy * skillScale, wantsSprint, false, dt, pitch);
      } else {
        // Tactical off-the-ball positioning (support attack or shift defensively)
        const shiftX = b.x * 0.48 + (teamHasBall ? attackDir * 7.5 : -attackDir * 4.5);
        const shiftY = b.y * 0.36;

        let targetX = p.anchorX + shiftX;
        let targetY = p.anchorY + shiftY;

        // Forwards make attacking runs into space when team has possession
        if (teamHasBall && p.role === 'FWD') {
          targetX += attackDir * 5.5;
          targetY += Math.sin(p.animPhase * 0.4) * 3.2;
        }

        targetX = Math.max(-pitch.halfW + 4.5, Math.min(pitch.halfW - 4.5, targetX));
        targetY = Math.max(-pitch.halfH + 3.0, Math.min(pitch.halfH - 3.0, targetY));

        const dx = targetX - p.x;
        const dy = targetY - p.y;
        const distSq = dx * dx + dy * dy;

        if (distSq > 0.8) {
          const wantsSprint = distSq > 95 && p.stamina > 45;
          player.applyMovement(dx * 0.85 * skillScale, dy * 0.85 * skillScale, wantsSprint, false, dt, pitch);
        } else {
          player.applyMovement(0, 0, false, false, dt, pitch);
          // Face the ball when holding tactical position
          p.angle = Math.atan2(b.y - p.y, b.x - p.x);
        }
      }
    }
  }

  private updateGoalkeeper(
    dt: number,
    gk: Player,
    myTeam: Team,
    oppTeam: Team,
    ball: Ball,
    pitch: PitchConfig,
    hasBall: boolean,
    ownGoalX: number,
    attackDir: number,
    onSoundEvent?: (type: 'pass' | 'shoot' | 'tackle') => void
  ): void {
    const p = gk.state;
    const b = ball.state;

    if (hasBall) {
      // GK distributes ball quickly to an open defender or midfielder
      let bestMate: Player | null = null;
      let bestScore = -Infinity;

      for (let i = 1; i < myTeam.players.length; i++) {
        const mate = myTeam.players[i];
        const mx = mate.state.x;
        const my = mate.state.y;
        let nearestOppDistSq = Infinity;
        for (let j = 0; j < oppTeam.players.length; j++) {
          const ox = oppTeam.players[j].state.x - mx;
          const oy = oppTeam.players[j].state.y - my;
          const dSq = ox * ox + oy * oy;
          if (dSq < nearestOppDistSq) nearestOppDistSq = dSq;
        }
        const score = nearestOppDistSq + mx * attackDir * 2;
        if (score > bestScore) {
          bestScore = score;
          bestMate = mate;
        }
      }

      const passX = bestMate ? bestMate.state.x - p.x : attackDir * 20;
      const passY = bestMate ? bestMate.state.y - p.y : (Math.random() - 0.5) * 12;
      p.angle = Math.atan2(passY, passX);
      gk.triggerAction('pass', 0.28);
      ball.kick(passX, passY, 24, 3.2, myTeam.id, p.name, myTeam.kit.accentColor);
      if (onSoundEvent) onSoundEvent('pass');
      return;
    }

    // Track ball Y clamped within goal width, step out slightly when ball approaches penalty box
    const halfGoalY = pitch.goalWidth * 0.46;
    const distToOwnGoalX = Math.abs(b.x - ownGoalX);
    let targetX = ownGoalX + attackDir * (distToOwnGoalX < 18 ? 3.2 : 1.8);
    let targetY = Math.max(-halfGoalY, Math.min(halfGoalY, b.y * 0.62));

    // If ball is loose right inside the goal area, rush out to claim it
    if (!b.ownerId && distToOwnGoalX < pitch.goalAreaW + 2.5 && Math.abs(b.y) < pitch.goalAreaH * 0.6) {
      targetX = b.x;
      targetY = b.y;
    }

    const dx = targetX - p.x;
    const dy = targetY - p.y;
    if (dx * dx + dy * dy > 0.12) {
      gk.applyMovement(dx * 1.4, dy * 1.4, distToOwnGoalX < 16, false, dt, pitch);
    } else {
      gk.applyMovement(0, 0, false, false, dt, pitch);
      p.angle = Math.atan2(b.y - p.y, b.x - p.x);
    }
  }

  private updateBallCarrier(
    dt: number,
    carrier: Player,
    myTeam: Team,
    oppTeam: Team,
    ball: Ball,
    pitch: PitchConfig,
    targetGoalX: number,
    attackDir: number,
    skillScale: number,
    onSoundEvent?: (type: 'pass' | 'shoot' | 'tackle') => void
  ): void {
    const p = carrier.state;
    const dxGoal = targetGoalX - p.x;
    const distToGoalX = Math.abs(dxGoal);

    // 1. Check if within shooting range and angle
    const inShootingZone = distToGoalX < 21 && Math.abs(p.y) < pitch.penaltyAreaH * 0.55;
    if (inShootingZone && this.aiDecisionCooldown <= 0) {
      // Aim for top or bottom corner away from opposing GK
      const oppGk = oppTeam.players[0].state;
      const aimCornerY =
        oppGk.y > 0
          ? -pitch.goalWidth * 0.34
          : pitch.goalWidth * 0.34;
      const shotDx = targetGoalX - p.x;
      const shotDy = aimCornerY - p.y + (Math.random() - 0.5) * 1.6;
      const shotPower = 29 + Math.random() * 5 * skillScale;

      p.angle = Math.atan2(shotDy, shotDx);
      carrier.triggerAction('shoot', 0.35);
      ball.kick(shotDx, shotDy, shotPower, 2.6 + Math.random() * 2.2, myTeam.id, p.name, '#fbbf24');
      this.aiDecisionCooldown = 0.45;
      if (onSoundEvent) onSoundEvent('shoot');
      return;
    }

    // 2. Check pressure from nearest opponent
    let nearestOppDistSq = Infinity;
    let repulseX = 0;
    let repulseY = 0;

    for (let i = 0; i < oppTeam.players.length; i++) {
      const opp = oppTeam.players[i].state;
      const ox = p.x - opp.x;
      const oy = p.y - opp.y;
      const dSq = ox * ox + oy * oy;
      if (dSq < nearestOppDistSq) {
        nearestOppDistSq = dSq;
      }
      if (dSq < 28 && dSq > 0.01) {
        const inv = 1 / dSq;
        repulseX += ox * inv * 6;
        repulseY += oy * inv * 6;
      }
    }

    // 3. Look for a forward or open pass if pressured or if a teammate is in a much better attacking position
    if (this.aiDecisionCooldown <= 0 && (nearestOppDistSq < 18 || Math.random() < 0.035)) {
      let bestTarget: Player | null = null;
      let bestScore = -Infinity;

      for (let i = 1; i < myTeam.players.length; i++) {
        const mate = myTeam.players[i];
        if (mate.state.id === p.id) continue;

        const mx = mate.state.x - p.x;
        const my = mate.state.y - p.y;
        const passDistSq = mx * mx + my * my;
        if (passDistSq < 20 || passDistSq > 950) continue;

        // Reward forward progression toward opponent goal
        const forwardGain = (mate.state.x - p.x) * attackDir;

        // Check how open the teammate is
        let mateSpaceSq = Infinity;
        for (let j = 0; j < oppTeam.players.length; j++) {
          const odx = oppTeam.players[j].state.x - mate.state.x;
          const ody = oppTeam.players[j].state.y - mate.state.y;
          const dSq = odx * odx + ody * ody;
          if (dSq < mateSpaceSq) mateSpaceSq = dSq;
        }

        const score = forwardGain * 2.2 + Math.min(60, mateSpaceSq) * 0.45;
        if (score > bestScore && (forwardGain > -3 || nearestOppDistSq < 12)) {
          bestScore = score;
          bestTarget = mate;
        }
      }

      if (bestTarget && bestScore > 8) {
        const leadX = bestTarget.state.x + bestTarget.state.vx * 0.22 - p.x;
        const leadY = bestTarget.state.y + bestTarget.state.vy * 0.22 - p.y;
        const dist = Math.sqrt(leadX * leadX + leadY * leadY);
        const passSpeed = Math.min(27, Math.max(17, dist * 1.15));

        p.angle = Math.atan2(leadY, leadX);
        carrier.triggerAction('pass', 0.25);
        ball.kick(leadX, leadY, passSpeed, dist > 22 ? 2.4 : 0.4, myTeam.id, p.name, myTeam.kit.accentColor);
        this.aiDecisionCooldown = 0.42;
        if (onSoundEvent) onSoundEvent('pass');
        return;
      }
    }

    // 4. Dribble toward opposing goal while steering around nearby defenders
    const driveX = dxGoal * 0.65 + repulseX;
    const driveY = (0 - p.y) * 0.28 + repulseY;
    const wantsSprint = nearestOppDistSq > 16 && distToGoalX > 14 && p.stamina > 25;

    carrier.applyMovement(driveX * skillScale, driveY * skillScale, wantsSprint, true, dt, pitch);
  }
}
