import { Camera, Pause } from 'lucide-react';
import { CameraMode, MatchHUDState } from '../types/game';

interface ScoreboardProps {
  hud: MatchHUDState;
  onPause: () => void;
  onToggleCamera: () => void;
  cameraMode: CameraMode;
}

export function Scoreboard({ hud, onPause, onToggleCamera, cameraMode }: ScoreboardProps) {
  const totalSeconds = Math.max(0, Math.ceil(hud.timeRemaining));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  const formattedClock = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  const cameraLabel =
    cameraMode === 'action'
      ? 'Action 3D'
      : cameraMode === 'endline'
      ? 'Endline 3D'
      : cameraMode === 'tactical'
      ? 'Tactical 4D'
      : 'Broadcast 3D';

  return (
    <>
      {/* Top Broadcast Scoreboard Bar */}
      <div className="fixed top-3 left-0 right-0 z-10 px-4 flex items-center justify-between max-w-6xl mx-auto pointer-events-none">
        {/* Controlled Player Indicator (Left) */}
        <div className="hidden sm:flex items-center gap-2.5 bg-slate-950/90 border border-slate-800 px-3.5 py-1.5 rounded-lg text-xs text-slate-200 pointer-events-auto shadow-lg backdrop-blur-xs">
          <span
            className="w-2.5 h-2.5 rounded-xs shrink-0"
            style={{ backgroundColor: hud.homeTeam.primaryColor }}
          />
          <span className="font-mono-tabular font-bold text-sky-400">
            #{hud.controlledPlayerNumber}
          </span>
          <span className="font-semibold text-white whitespace-nowrap">
            {hud.controlledPlayerName}
          </span>
          <span aria-hidden="true" className="text-slate-600">
            ·
          </span>
          <span className="text-slate-400">{hud.controlledPlayerRole}</span>
        </div>

        {/* Center Match Score & Clock */}
        <div className="mx-auto sm:mx-0 flex items-center bg-slate-950/92 border border-slate-800 rounded-xl overflow-hidden shadow-2xl pointer-events-auto backdrop-blur-xs">
          {/* Home Team */}
          <div className="flex items-center gap-2.5 px-3.5 py-1.5">
            <span
              className="w-3 h-3 rounded-xs shrink-0"
              style={{ backgroundColor: hud.homeTeam.primaryColor }}
            />
            <span className="font-display font-bold text-base tracking-wide text-white">
              {hud.homeTeam.shortName}
            </span>
          </div>

          {/* Score Box */}
          <div className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-900 border-x border-slate-800 font-mono-tabular font-bold text-lg text-white">
            <span>{hud.homeScore}</span>
            <span className="text-slate-500">-</span>
            <span>{hud.awayScore}</span>
          </div>

          {/* Away Team */}
          <div className="flex items-center gap-2.5 px-3.5 py-1.5">
            <span className="font-display font-bold text-base tracking-wide text-white">
              {hud.awayTeam.shortName}
            </span>
            <span
              className="w-3 h-3 rounded-xs shrink-0"
              style={{ backgroundColor: hud.awayTeam.primaryColor }}
            />
          </div>

          {/* Match Clock */}
          <div className="px-3.5 py-1.5 bg-sky-500 text-slate-950 font-mono-tabular font-bold text-sm">
            {formattedClock}
          </div>
        </div>

        {/* Right Actions: Camera View Switcher + Pause Button */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={onToggleCamera}
            title="Switch 3D / 4D Camera Perspective (V key)"
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-950/90 hover:bg-slate-900 border border-slate-800 rounded-lg text-xs font-medium text-slate-200 transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-lg backdrop-blur-xs"
          >
            <Camera className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline font-mono text-[11px] uppercase tracking-wider text-sky-300">
              {cameraLabel}
            </span>
          </button>

          <button
            type="button"
            onClick={onPause}
            aria-label="Pause Match"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-950/90 hover:bg-slate-900 border border-slate-800 rounded-lg text-xs font-medium text-slate-200 transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-lg backdrop-blur-xs"
          >
            <Pause className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Pause</span>
          </button>
        </div>
      </div>

      {/* Goal Celebration Broadcast Banner */}
      {hud.goalBanner && (
        <div className="fixed inset-x-0 top-20 z-20 flex justify-center pointer-events-none px-4">
          <div className="bg-slate-950/95 border border-sky-400/50 rounded-xl px-8 py-4 text-center shadow-2xl backdrop-blur-md animate-bounce">
            <p className="font-display font-bold text-4xl md:text-5xl tracking-wider text-sky-400 leading-none mb-1">
              GOAL!
            </p>
            <p className="text-sm font-medium text-white">
              {hud.goalBanner.scoringTeam === 'home'
                ? hud.homeTeam.name
                : hud.awayTeam.name}{' '}
              · #{hud.goalBanner.scorerNumber} {hud.goalBanner.scorerName} (
              {hud.goalBanner.minuteText})
            </p>
          </div>
        </div>
      )}

      {/* Throw-In / Goal Kick / Corner Kick Banner */}
      {hud.restartBanner && !hud.goalBanner && (
        <div className="fixed inset-x-0 top-20 z-20 flex justify-center pointer-events-none px-4">
          <div className="bg-slate-950/90 border border-slate-700 rounded-lg px-5 py-2 text-center shadow-lg backdrop-blur-xs">
            <p className="font-display font-bold text-lg tracking-wide text-amber-300">
              {hud.restartBanner.label}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
