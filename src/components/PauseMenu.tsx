import { Play, RotateCcw, Home, Volume2, VolumeX, Camera } from 'lucide-react';
import { MatchSettings } from '../types/game';

interface PauseMenuProps {
  settings: MatchSettings;
  onResume: () => void;
  onRestart: () => void;
  onMainMenu: () => void;
  onUpdateSettings: (partial: Partial<MatchSettings>) => void;
}

export function PauseMenu({
  settings,
  onResume,
  onRestart,
  onMainMenu,
  onUpdateSettings,
}: PauseMenuProps) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-slate-950/80">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
        <h2 className="font-display font-bold text-3xl text-white tracking-wide text-center mb-1">
          MATCH PAUSED
        </h2>
        <p className="text-xs text-slate-400 text-center mb-6">
          Press Escape or click Resume to return to the pitch
        </p>

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full py-3 px-4 bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-sm rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Play className="w-4 h-4 fill-slate-950" />
            <span>Resume Match</span>
          </button>

          <button
            type="button"
            onClick={onRestart}
            className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white font-medium text-sm rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Restart Kickoff</span>
          </button>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => onUpdateSettings({ soundEnabled: !settings.soundEnabled })}
              className="py-2.5 px-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-medium rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              {settings.soundEnabled ? (
                <Volume2 className="w-4 h-4 text-sky-400" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-500" />
              )}
              <span>{settings.soundEnabled ? 'Sound On' : 'Muted'}</span>
            </button>

            <button
              type="button"
              onClick={() =>
                onUpdateSettings({
                  cameraZoom: settings.cameraZoom === 'broadcast' ? 'wide' : 'broadcast',
                })
              }
              className="py-2.5 px-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-medium rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Camera className="w-4 h-4 text-sky-400" />
              <span>{settings.cameraZoom === 'broadcast' ? 'Broadcast Cam' : 'Wide Cam'}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onMainMenu}
            className="w-full py-2.5 px-4 mt-2 bg-transparent hover:bg-slate-800/60 border border-slate-800 text-slate-300 hover:text-white text-sm font-medium rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Home className="w-4 h-4" />
            <span>Return to Main Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
}
