import {
  GoalBannerInfo,
  MatchHUDState,
  MatchPhase,
  MatchSettings,
  PitchConfig,
  RestartBannerInfo,
  TeamId,
} from '../types/game';
import { Ball } from './Ball';
import { Collision } from './Collision';
import { FootballRules } from './FootballRules';
import { InputController } from './InputController';
import { OpponentAI } from './OpponentAI';
import { Player } from './Player';
import { AWAY_KIT, HOME_KIT, Team } from './Team';

export const DEFAULT_PITCH: PitchConfig = {
  width: 68,
  height: 42,
  halfW: 34,
  halfH: 21,
  goalWidth: 9.2,
  goalDepth: 2.8,
  goalHeight: 3.1,
  penaltyAreaW: 11.5,
  penaltyAreaH: 22.0,
  goalAreaW: 4.5,
  goalAreaH: 11.6,
  centerCircleRadius: 6.4,
};

export class GameEngine {
  public readonly pitch: PitchConfig = DEFAULT_PITCH;
  public readonly ball: Ball;
  public readonly homeTeam: Team;
  public readonly awayTeam: Team;
  public readonly allPlayers: Player[];
  public readonly input: InputController;
  public readonly ai: OpponentAI;

  public phase: MatchPhase = 'MENU';
  public settings: MatchSettings = {
    matchDurationSeconds: 120, // 2-minute fast arcade match by default
    difficulty: 'standard',
    soundEnabled: true,
    cameraZoom: 'broadcast',
  };

  public homeScore = 0;
  public awayScore = 0;
  public timeRemaining = 120;
  public controlledPlayerId: string;
  public kickoffTeam: TeamId = 'home';

  private phaseTimer = 0;
  private hudSyncAccumulator = 0;
  private lastHudSecond = -1;
  private goalBanner: GoalBannerInfo | null = null;
  private restartBanner: RestartBannerInfo | null = null;
  private pendingRestart: {
    type: 'THROW_IN' | 'GOAL_KICK' | 'CORNER_KICK';
    team: TeamId;
    x: number;
    y: number;
  } | null = null;

  public stats = {
    homeShots: 0,
    awayShots: 0,
    homePasses: 0,
    awayPasses: 0,
    homePossessionTicks: 1,
    awayPossessionTicks: 1,
  };

  private onHudUpdate?: (hud: MatchHUDState) => void;
  private audioCtx: AudioContext | null = null;

  constructor(onHudUpdate?: (hud: MatchHUDState) => void) {
    this.onHudUpdate = onHudUpdate;
    this.ball = new Ball();
    this.homeTeam = new Team('home', this.pitch);
    this.awayTeam = new Team('away', this.pitch);
    this.allPlayers = [...this.homeTeam.players, ...this.awayTeam.players];
    this.input = new InputController();
    this.ai = new OpponentAI();
    this.controlledPlayerId = this.homeTeam.players[4].state.id; // Forward #9 Saka

    this.setupKickoff('home');
    this.phase = 'MENU';
  }

  public setHudCallback(cb: (hud: MatchHUDState) => void): void {
    this.onHudUpdate = cb;
    this.emitHudState();
  }

  public updateSettings(partial: Partial<MatchSettings>): void {
    this.settings = { ...this.settings, ...partial };
    if (this.phase === 'MENU') {
      this.timeRemaining = this.settings.matchDurationSeconds;
    }
    this.emitHudState();
  }

  public startNewMatch(): void {
    this.homeScore = 0;
    this.awayScore = 0;
    this.timeRemaining = this.settings.matchDurationSeconds;
    this.lastHudSecond = Math.ceil(this.timeRemaining);
    this.stats = {
      homeShots: 0,
      awayShots: 0,
      homePasses: 0,
      awayPasses: 0,
      homePossessionTicks: 1,
      awayPossessionTicks: 1,
    };
    this.goalBanner = null;
    this.restartBanner = null;
    this.setupKickoff('home');
    this.phase = 'KICKOFF';
    this.phaseTimer = 0.9;
    this.playSound('whistle');
    this.emitHudState();
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING' || this.phase === 'KICKOFF') {
      this.phase = 'PAUSED';
      this.emitHudState();
    } else if (this.phase === 'PAUSED') {
      this.phase = 'PLAYING';
      this.emitHudState();
    }
  }

  public returnToMenu(): void {
    this.goalBanner = null;
    this.restartBanner = null;
    this.setupKickoff('home');
    this.phase = 'MENU';
    this.emitHudState();
  }

  private setupKickoff(team: TeamId): void {
    this.kickoffTeam = team;
    this.ball.reset(0, 0);
    this.homeTeam.resetForKickoff(team === 'home');
    this.awayTeam.resetForKickoff(team === 'away');

    // Give kickoff taker initial control
    const forward = this.homeTeam.players[4];
    this.controlledPlayerId = forward.state.id;
    if (team === 'home') {
      this.ball.state.ownerId = forward.state.id;
      this.ball.state.lastTouchTeam = 'home';
      this.ball.state.lastTouchPlayerName = forward.state.name;
    } else {
      const awayFwd = this.awayTeam.players[4];
      this.ball.state.ownerId = awayFwd.state.id;
      this.ball.state.lastTouchTeam = 'away';
      this.ball.state.lastTouchPlayerName = awayFwd.state.name;
    }
  }

  public getControlledPlayer(): Player {
    for (let i = 0; i < this.homeTeam.players.length; i++) {
      if (this.homeTeam.players[i].state.id === this.controlledPlayerId) {
        return this.homeTeam.players[i];
      }
    }
    return this.homeTeam.players[4];
  }

  /**
   * Finds the best teammate to receive a pass from the controlled player.
   */
  public findPassTarget(fromPlayer: Player, dirX: number, dirY: number): Player | null {
    const p = fromPlayer.state;
    const hasDir = dirX * dirX + dirY * dirY > 0.04;
    let aimX = hasDir ? dirX : Math.cos(p.angle);
    let aimY = hasDir ? dirY : Math.sin(p.angle);
    const aimLen = Math.max(0.001, Math.sqrt(aimX * aimX + aimY * aimY));
    aimX /= aimLen;
    aimY /= aimLen;

    let bestMate: Player | null = null;
    let bestScore = -Infinity;

    for (let i = 0; i < this.homeTeam.players.length; i++) {
      const mate = this.homeTeam.players[i];
      if (mate.state.id === p.id) continue;

      const dx = mate.state.x - p.x;
      const dy = mate.state.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1.5) continue;

      const nx = dx / dist;
      const ny = dy / dist;
      const dot = nx * aimX + ny * aimY; // Alignment with desired direction (-1..1)

      if (hasDir && dot < -0.15) continue;

      const score = dot * 30 - dist * 0.38 + (mate.state.role === 'GK' ? -8 : 0);
      if (score > bestScore) {
        bestScore = score;
        bestMate = mate;
      }
    }

    return bestMate;
  }

  public update(dt: number): void {
    this.input.update(dt);

    if (this.input.state.pauseJustPressed && this.phase !== 'MENU' && this.phase !== 'FULL_TIME') {
      this.togglePause();
      this.input.consumeOneShotFlags();
      return;
    }

    if (this.phase === 'PAUSED' || this.phase === 'FULL_TIME') {
      this.input.consumeOneShotFlags();
      return;
    }

    // Background attract simulation while on Main Menu
    if (this.phase === 'MENU') {
      this.ai.update(dt, this.homeTeam, this.awayTeam, '', this.ball, this.pitch, 'standard');
      this.ball.update(dt, this.pitch);
      Collision.resolvePlayerCollisions(this.allPlayers);
      Collision.handleBallPlayerInteractions(this.ball, this.allPlayers, this.pitch);
      const ruleRes = FootballRules.checkBallBounds(this.ball, this.pitch);
      if (ruleRes.event !== 'NONE') {
        this.setupKickoff(Math.random() < 0.5 ? 'home' : 'away');
      }
      this.input.consumeOneShotFlags();
      return;
    }

    // Handle timed sub-phases (Kickoff whistle pause, Goal celebration, Out of bounds restart)
    if (this.phase === 'KICKOFF') {
      this.phaseTimer -= dt;
      if (
        this.phaseTimer <= 0 ||
        Math.abs(this.input.state.moveX) > 0.1 ||
        Math.abs(this.input.state.moveY) > 0.1 ||
        this.input.state.passJustReleased ||
        this.input.state.shootJustReleased
      ) {
        this.phase = 'PLAYING';
        this.restartBanner = null;
        this.emitHudState();
      }
      this.input.consumeOneShotFlags();
      return;
    }

    if (this.phase === 'GOAL_CELEBRATION') {
      this.phaseTimer -= dt;
      // Scorer & teammates run celebration animation
      for (const p of this.allPlayers) {
        if (p.state.team === this.goalBanner?.scoringTeam) {
          p.state.animState = 'celebrate';
          p.state.animPhase += dt * 11;
          p.state.x += Math.cos(p.state.angle) * 3.5 * dt;
          p.state.y += Math.sin(p.state.angle) * 3.5 * dt;
        } else {
          p.state.animState = 'idle';
        }
      }
      this.ball.update(dt, this.pitch);

      if (this.phaseTimer <= 0) {
        const nextKickoff: TeamId = this.goalBanner?.scoringTeam === 'home' ? 'away' : 'home';
        this.goalBanner = null;
        this.setupKickoff(nextKickoff);
        this.phase = 'KICKOFF';
        this.phaseTimer = 0.85;
        this.playSound('whistle');
        this.emitHudState();
      }
      this.input.consumeOneShotFlags();
      return;
    }

    if (this.phase === 'OUT_OF_BOUNDS') {
      this.phaseTimer -= dt;
      this.ball.update(dt, this.pitch);
      if (this.phaseTimer <= 0 && this.pendingRestart) {
        const r = this.pendingRestart;
        const takerId = FootballRules.setupRestart(
          r.type,
          r.team,
          r.x,
          r.y,
          this.ball,
          this.homeTeam,
          this.awayTeam,
          this.pitch
        );
        if (r.team === 'home') {
          this.controlledPlayerId = takerId;
        }
        this.pendingRestart = null;
        this.restartBanner = null;
        this.phase = 'PLAYING';
        this.playSound('whistle');
        this.emitHudState();
      }
      this.input.consumeOneShotFlags();
      return;
    }

    // --- ACTIVE PLAYING PHASE ---
    this.timeRemaining = Math.max(0, this.timeRemaining - dt);
    if (this.timeRemaining <= 0) {
      this.phase = 'FULL_TIME';
      this.playSound('whistle');
      this.emitHudState();
      this.input.consumeOneShotFlags();
      return;
    }

    // Track possession statistics
    if (this.ball.state.lastTouchTeam === 'home') {
      this.stats.homePossessionTicks++;
    } else if (this.ball.state.lastTouchTeam === 'away') {
      this.stats.awayPossessionTicks++;
    }

    // 1. Process Human Player Input
    const controlled = this.getControlledPlayer();
    const cState = controlled.state;
    const userHasBall = this.ball.state.ownerId === cState.id;

    // Handle Switch Player / Tackle action
    if (this.input.state.switchOrTackleJustPressed && !userHasBall) {
      const dxBall = this.ball.state.x - cState.x;
      const dyBall = this.ball.state.y - cState.y;
      const distBallSq = dxBall * dxBall + dyBall * dyBall;

      // If controlled player is already very close to the ball carrier, execute a lunge tackle!
      if (distBallSq < 14 && cState.tackleCooldown <= 0) {
        cState.angle = Math.atan2(dyBall, dxBall);
        controlled.triggerAction('tackle', 0.3);
        this.playSound('tackle');
      } else {
        this.switchToNearestHomePlayer();
      }
    }

    const activePlayer = this.getControlledPlayer();
    const apState = activePlayer.state;
    const activeHasBall = this.ball.state.ownerId === apState.id;

    // Movement for human-controlled player
    activePlayer.applyMovement(
      this.input.state.moveX,
      this.input.state.moveY,
      this.input.state.sprint,
      activeHasBall,
      dt,
      this.pitch
    );

    // Handle Pass execution
    if (this.input.state.passJustReleased) {
      if (activeHasBall) {
        const target = this.findPassTarget(
          activePlayer,
          this.input.state.moveX,
          this.input.state.moveY
        );
        let dirX = Math.cos(apState.angle);
        let dirY = Math.sin(apState.angle);
        let passSpeed = 19 + this.input.state.passCharge * 9;

        if (target) {
          // Lead moving teammate slightly
          dirX = target.state.x + target.state.vx * 0.2 - apState.x;
          dirY = target.state.y + target.state.vy * 0.2 - apState.y;
          const dist = Math.sqrt(dirX * dirX + dirY * dirY);
          passSpeed = Math.min(28, Math.max(17, dist * 1.18 + this.input.state.passCharge * 5));
          // Switch control immediately to receiver so player can one-touch or receive smoothly
          this.controlledPlayerId = target.state.id;
        }

        apState.angle = Math.atan2(dirY, dirX);
        activePlayer.triggerAction('pass', 0.25);
        this.ball.kick(
          dirX,
          dirY,
          passSpeed,
          this.input.state.passCharge > 0.55 ? 3.2 : 0.4,
          'home',
          apState.name,
          HOME_KIT.accentColor
        );
        this.stats.homePasses++;
        this.playSound('pass');
        this.emitHudState();
      } else if (apState.tackleCooldown <= 0) {
        // Pressing Pass without ball performs a quick standing tackle toward the ball
        const dxB = this.ball.state.x - apState.x;
        const dyB = this.ball.state.y - apState.y;
        if (dxB * dxB + dyB * dyB < 20) {
          apState.angle = Math.atan2(dyB, dxB);
          activePlayer.triggerAction('tackle', 0.26);
          this.playSound('tackle');
        } else {
          this.switchToNearestHomePlayer();
        }
      }
    }

    // Handle Shoot execution
    if (this.input.state.shootJustReleased && activeHasBall) {
      const charge = Math.max(0.22, this.input.state.shootCharge);
      // Aim toward Away goal (+halfW) with directional y bias from joystick/keys
      const goalX = this.pitch.halfW;
      const aimY = this.input.state.moveY * (this.pitch.goalWidth * 0.44);
      const shotDx = goalX - apState.x;
      const shotDy = aimY - apState.y;
      const shotSpeed = 25 + charge * 13;
      const loft = 1.6 + charge * 4.2;

      apState.angle = Math.atan2(shotDy, shotDx);
      activePlayer.triggerAction('shoot', 0.34);
      this.ball.kick(shotDx, shotDy, shotSpeed, loft, 'home', apState.name, '#fbbf24');
      this.stats.homeShots++;
      this.playSound('shoot');
    }

    // 2. Update AI for teammates and opposing team
    this.ai.update(
      dt,
      this.homeTeam,
      this.awayTeam,
      this.controlledPlayerId,
      this.ball,
      this.pitch,
      this.settings.difficulty,
      (soundType) => {
        if (soundType === 'shoot') this.stats.awayShots++;
        if (soundType === 'pass') this.stats.awayPasses++;
        this.playSound(soundType);
      }
    );

    // 3. Update Ball & Collisions
    this.ball.update(dt, this.pitch);
    Collision.resolvePlayerCollisions(this.allPlayers);
    Collision.handleBallPlayerInteractions(
      this.ball,
      this.allPlayers,
      this.pitch,
      (newOwner, wasTackle) => {
        if (wasTackle) this.playSound('tackle');
        // If a Home player gains possession, automatically switch control to them!
        if (newOwner.state.team === 'home') {
          this.controlledPlayerId = newOwner.state.id;
          this.emitHudState();
        }
      }
    );

    // Auto-switch to nearest home defender if ball breaks loose far from current controlled player
    if (!this.ball.state.ownerId || this.ball.state.ownerId.startsWith('away')) {
      const curr = this.getControlledPlayer().state;
      const currDistSq =
        (this.ball.state.x - curr.x) * (this.ball.state.x - curr.x) +
        (this.ball.state.y - curr.y) * (this.ball.state.y - curr.y);
      if (currDistSq > 195) {
        this.switchToNearestHomePlayer(true);
      }
    }

    // 4. Check Football Rules (Goals & Out of Bounds)
    const ruleCheck = FootballRules.checkBallBounds(this.ball, this.pitch);
    if (ruleCheck.event === 'GOAL' && ruleCheck.scoringTeam) {
      if (ruleCheck.scoringTeam === 'home') {
        this.homeScore++;
      } else {
        this.awayScore++;
      }
      const elapsedRatio =
        1 - this.timeRemaining / Math.max(1, this.settings.matchDurationSeconds);
      const matchMinute = Math.max(1, Math.min(90, Math.floor(elapsedRatio * 90) + 1));

      this.goalBanner = {
        scoringTeam: ruleCheck.scoringTeam,
        scorerName: this.ball.state.lastTouchPlayerName || (ruleCheck.scoringTeam === 'home' ? 'Saka' : 'Leao'),
        scorerNumber: ruleCheck.scoringTeam === 'home' ? 9 : 11,
        minuteText: `${matchMinute}'`,
      };
      this.phase = 'GOAL_CELEBRATION';
      this.phaseTimer = 2.6;
      this.playSound('goal');
      this.emitHudState();
    } else if (
      ruleCheck.event === 'OUT_OF_BOUNDS' &&
      ruleCheck.restartType &&
      ruleCheck.restartTeam &&
      ruleCheck.restartX !== undefined &&
      ruleCheck.restartY !== undefined
    ) {
      const teamName = ruleCheck.restartTeam === 'home' ? HOME_KIT.shortName : AWAY_KIT.shortName;
      const typeLabel =
        ruleCheck.restartType === 'THROW_IN'
          ? 'Throw-In'
          : ruleCheck.restartType === 'CORNER_KICK'
          ? 'Corner Kick'
          : 'Goal Kick';
      this.restartBanner = {
        type: ruleCheck.restartType,
        team: ruleCheck.restartTeam,
        label: `${typeLabel} · ${teamName}`,
      };
      this.pendingRestart = {
        type: ruleCheck.restartType as 'THROW_IN' | 'GOAL_KICK' | 'CORNER_KICK',
        team: ruleCheck.restartTeam,
        x: ruleCheck.restartX,
        y: ruleCheck.restartY,
      };
      this.phase = 'OUT_OF_BOUNDS';
      this.phaseTimer = 1.05;
      this.playSound('whistle');
      this.emitHudState();
    }

    // Sync HUD when timer second ticks or stamina changes noticeably
    this.hudSyncAccumulator += dt;
    const currentSec = Math.ceil(this.timeRemaining);
    if (currentSec !== this.lastHudSecond || this.hudSyncAccumulator > 0.25) {
      this.lastHudSecond = currentSec;
      this.hudSyncAccumulator = 0;
      this.emitHudState();
    }

    this.input.consumeOneShotFlags();
  }

  public switchToNearestHomePlayer(silent = false): void {
    const b = this.ball.state;
    let bestId = this.controlledPlayerId;
    let bestDistSq = Infinity;

    for (let i = 1; i < this.homeTeam.players.length; i++) {
      const p = this.homeTeam.players[i].state;
      if (!silent && p.id === this.controlledPlayerId) continue;
      const dx = b.x - p.x;
      const dy = b.y - p.y;
      const dSq = dx * dx + dy * dy;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestId = p.id;
      }
    }

    if (bestId !== this.controlledPlayerId) {
      this.controlledPlayerId = bestId;
      this.emitHudState();
    }
  }

  public getHudState(): MatchHUDState {
    const ctrl = this.getControlledPlayer().state;
    let possessionTeam: TeamId | null = null;
    if (this.ball.state.ownerId) {
      possessionTeam = this.ball.state.ownerId.startsWith('home') ? 'home' : 'away';
    }

    return {
      phase: this.phase,
      homeScore: this.homeScore,
      awayScore: this.awayScore,
      timeRemaining: this.timeRemaining,
      totalDuration: this.settings.matchDurationSeconds,
      controlledPlayerName: ctrl.name,
      controlledPlayerNumber: ctrl.number,
      controlledPlayerRole: ctrl.role,
      controlledPlayerStamina: Math.round(ctrl.stamina),
      possessionTeam,
      goalBanner: this.goalBanner,
      restartBanner: this.restartBanner,
      homeTeam: HOME_KIT,
      awayTeam: AWAY_KIT,
      stats: { ...this.stats },
    };
  }

  private emitHudState(): void {
    if (this.onHudUpdate) {
      this.onHudUpdate(this.getHudState());
    }
  }

  /**
   * Zero-dependency synthesized Web Audio sound effects for kicks, passes, whistles, and goals.
   */
  public playSound(type: 'pass' | 'shoot' | 'tackle' | 'whistle' | 'goal'): void {
    if (!this.settings.soundEnabled) return;
    try {
      const AudioContextClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      if (!this.audioCtx) {
        this.audioCtx = new AudioContextClass();
      }
      const ctx = this.audioCtx;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const now = ctx.currentTime;

      if (type === 'pass' || type === 'shoot') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        const startFreq = type === 'shoot' ? 145 : 120;
        osc.frequency.setValueAtTime(startFreq, now);
        osc.frequency.exponentialRampToValueAtTime(38, now + (type === 'shoot' ? 0.14 : 0.09));
        gain.gain.setValueAtTime(type === 'shoot' ? 0.26 : 0.16, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + (type === 'shoot' ? 0.15 : 0.1));
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.16);
      } else if (type === 'tackle') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(95, now);
        osc.frequency.exponentialRampToValueAtTime(42, now + 0.11);
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.13);
      } else if (type === 'whistle') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(2650, now);
        osc.frequency.setValueAtTime(2780, now + 0.06);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === 'goal') {
        // Celebratory chord chime
        const freqs = [261.63, 329.63, 392.0, 523.25];
        freqs.forEach((f, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(f, now + idx * 0.04);
          gain.gain.setValueAtTime(0.11, now + idx * 0.04);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.04);
          osc.stop(now + 0.78);
        });
      }
    } catch {
      // Ignore audio errors when autoplay is blocked
    }
  }

  public dispose(): void {
    this.input.detach();
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
  }
}
