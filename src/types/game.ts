export type TeamId = 'home' | 'away';

export type PlayerRole = 'GK' | 'DEF' | 'MID' | 'FWD';

export type PlayerAnimState =
  | 'idle'
  | 'walk'
  | 'run'
  | 'sprint'
  | 'pass'
  | 'shoot'
  | 'tackle'
  | 'celebrate';

export type MatchPhase =
  | 'MENU'
  | 'KICKOFF'
  | 'PLAYING'
  | 'GOAL_CELEBRATION'
  | 'OUT_OF_BOUNDS'
  | 'PAUSED'
  | 'FULL_TIME';

export type RestartType = 'KICKOFF' | 'THROW_IN' | 'GOAL_KICK' | 'CORNER_KICK';

export type DifficultyLevel = 'casual' | 'standard' | 'pro';

export type CameraMode = 'broadcast' | 'action' | 'endline' | 'tactical';

export interface Vec2 {
  x: number;
  y: number;
}

export interface PitchConfig {
  /** Total playable pitch length (X axis, meters-like units: -halfW to +halfW) */
  width: number;
  /** Total playable pitch width (Y axis, meters-like units: -halfH to +halfH) */
  height: number;
  halfW: number;
  halfH: number;
  goalWidth: number;
  goalDepth: number;
  goalHeight: number;
  penaltyAreaW: number;
  penaltyAreaH: number;
  goalAreaW: number;
  goalAreaH: number;
  centerCircleRadius: number;
}

export interface TeamKit {
  id: TeamId;
  name: string;
  shortName: string;
  primaryColor: string;
  secondaryColor: string;
  shortsColor: string;
  socksColor: string;
  gkColor: string;
  accentColor: string;
}

export interface PlayerState {
  id: string;
  team: TeamId;
  number: number;
  name: string;
  role: PlayerRole;
  /** Current 2D position on pitch */
  x: number;
  y: number;
  /** Current 2D velocity */
  vx: number;
  vy: number;
  /** Facing angle in radians */
  angle: number;
  /** Base formation anchor in team-normalized coords (-1..1) */
  anchorX: number;
  anchorY: number;
  /** Kickoff anchor in world coords */
  kickoffX: number;
  kickoffY: number;
  /** Physical attributes */
  maxSpeed: number;
  accel: number;
  stamina: number;
  maxStamina: number;
  radius: number;
  /** Animation & action timers */
  animState: PlayerAnimState;
  animPhase: number;
  actionTimer: number;
  tackleCooldown: number;
  stunTimer: number;
  /** Visual appearance customization */
  skinTone: string;
  hairColor: string;
}

export interface BallTrailPoint {
  x: number;
  y: number;
  z: number;
  alpha: number;
}

export interface ImpactEffect {
  active: boolean;
  x: number;
  y: number;
  z: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
}

export interface BallState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  radius: number;
  spinAngle: number;
  spinSpeed: number;
  ownerId: string | null;
  lastTouchTeam: TeamId | null;
  lastTouchPlayerName: string | null;
  pickupCooldown: number;
  trail: BallTrailPoint[];
}

export interface InputState {
  moveX: number;
  moveY: number;
  sprint: boolean;
  passPressed: boolean;
  passJustReleased: boolean;
  shootPressed: boolean;
  shootJustReleased: boolean;
  switchOrTackleJustPressed: boolean;
  pauseJustPressed: boolean;
  shootCharge: number;
  passCharge: number;
}

export interface MatchSettings {
  matchDurationSeconds: number;
  difficulty: DifficultyLevel;
  soundEnabled: boolean;
  cameraZoom: 'broadcast' | 'wide';
  cameraMode: CameraMode;
}

export interface GoalBannerInfo {
  scoringTeam: TeamId;
  scorerName: string;
  scorerNumber: number;
  minuteText: string;
}

export interface RestartBannerInfo {
  type: RestartType;
  team: TeamId;
  label: string;
}

export interface MatchHUDState {
  phase: MatchPhase;
  homeScore: number;
  awayScore: number;
  timeRemaining: number;
  totalDuration: number;
  controlledPlayerName: string;
  controlledPlayerNumber: number;
  controlledPlayerRole: PlayerRole;
  controlledPlayerStamina: number;
  possessionTeam: TeamId | null;
  goalBanner: GoalBannerInfo | null;
  restartBanner: RestartBannerInfo | null;
  homeTeam: TeamKit;
  awayTeam: TeamKit;
  stats: {
    homeShots: number;
    awayShots: number;
    homePasses: number;
    awayPasses: number;
    homePossessionTicks: number;
    awayPossessionTicks: number;
  };
}
