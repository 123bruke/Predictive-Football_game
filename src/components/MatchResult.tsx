import { RotateCcw, Home, Trophy } from 'lucide-react';
import { MatchHUDState } from '../types/game';

interface MatchResultProps {
  hud: MatchHUDState;
  onRematch: () => void;
  onMainMenu: () => void;
}

export function MatchResult({ hud, onRematch, onMainMenu }: MatchResultProps) {
  const isHomeWin = hud.homeScore > hud.awayScore;
  const isAwayWin = hud.awayScore > hud.homeScore;
  const resultHeadline = isHomeWin
    ? `${hud.homeTeam.name} Victory`
    : isAwayWin
    ? `${hud.awayTeam.name} Victory`
    : 'Match Drawn';

  const totalPossession = Math.max(
    1,
    hud.stats.homePossessionTicks + hud.stats.awayPossessionTicks
  );
  const homePossPct = Math.round((hud.stats.homePossessionTicks / totalPossession) * 100);
  const awayPossPct = 100 - homePossPct;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-slate-950/85">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl text-center">
        <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-sky-500/15 text-sky-400 mb-3">
          <Trophy className="w-6 h-6" />
        </div>

        <p className="text-xs font-medium text-slate-400 mb-1">Full-Time Result</p>
        <h2 className="font-display font-bold text-3xl md:text-4xl text-white tracking-wide mb-6">
          {resultHeadline}
        </h2>

        {/* Final Score Display */}
        <div className="grid grid-cols-3 items-center py-4 px-4 bg-slate-950 border border-slate-800 rounded-xl mb-6">
          <div className="flex flex-col items-center">
            <span
              className="w-4 h-4 rounded-xs mb-1.5"
              style={{ backgroundColor: hud.homeTeam.primaryColor }}
            />
            <span className="font-display font-bold text-lg text-white">
              {hud.homeTeam.shortName}
            </span>
            <span className="text-[11px] text-slate-400">You</span>
          </div>

          <div className="font-mono-tabular font-bold text-4xl text-white">
            {hud.homeScore} <span className="text-slate-600">-</span> {hud.awayScore}
          </div>

          <div className="flex flex-col items-center">
            <span
              className="w-4 h-4 rounded-xs mb-1.5"
              style={{ backgroundColor: hud.awayTeam.primaryColor }}
            />
            <span className="font-display font-bold text-lg text-white">
              {hud.awayTeam.shortName}
            </span>
            <span className="text-[11px] text-slate-400">CPU</span>
          </div>
        </div>

        {/* Clean Match Statistics Breakdown */}
        <div className="space-y-2.5 text-xs text-slate-300 mb-7">
          <div className="flex items-center justify-between py-1.5 border-b border-slate-800">
            <span className="font-mono-tabular font-semibold text-white">{homePossPct}%</span>
            <span className="text-slate-400">Possession</span>
            <span className="font-mono-tabular font-semibold text-white">{awayPossPct}%</span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-slate-800">
            <span className="font-mono-tabular font-semibold text-white">
              {hud.stats.homeShots}
            </span>
            <span className="text-slate-400">Shots</span>
            <span className="font-mono-tabular font-semibold text-white">
              {hud.stats.awayShots}
            </span>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="font-mono-tabular font-semibold text-white">
              {hud.stats.homePasses}
            </span>
            <span className="text-slate-400">Completed Passes</span>
            <span className="font-mono-tabular font-semibold text-white">
              {hud.stats.awayPasses}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onRematch}
            className="flex-1 py-3 px-5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-sm rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Play Rematch</span>
          </button>

          <button
            type="button"
            onClick={onMainMenu}
            className="py-3 px-5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Home className="w-4 h-4" />
            <span>Main Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
}
