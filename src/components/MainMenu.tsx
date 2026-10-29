import { useState } from 'react';
import { Play, SlidersHorizontal, Keyboard, Volume2, VolumeX } from 'lucide-react';
import { DifficultyLevel, MatchSettings, TeamKit } from '../types/game';

interface MainMenuProps {
  homeTeam: TeamKit;
  awayTeam: TeamKit;
  settings: MatchSettings;
  onStartMatch: () => void;
  onUpdateSettings: (partial: Partial<MatchSettings>) => void;
}

export function MainMenu({
  homeTeam,
  awayTeam,
  settings,
  onStartMatch,
  onUpdateSettings,
}: MainMenuProps) {
  const [activeDrawer, setActiveDrawer] = useState<'none' | 'settings' | 'controls'>('none');

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between p-6 md:p-10 pointer-events-none bg-gradient-to-t from-slate-950/85 via-slate-950/35 to-slate-950/65">
      {/* Top Bar Contract: 3 clean zones separated by gap-8 */}
      <header className="w-full max-w-6xl mx-auto flex items-center justify-between gap-8 pointer-events-auto">
        <span className="font-display text-2xl font-bold tracking-tight text-white whitespace-nowrap shrink-0">
          PitchSide 5v5
        </span>

        <nav className="hidden sm:flex items-center gap-6 text-sm font-medium text-slate-300">
          <button
            type="button"
            onClick={() => setActiveDrawer(activeDrawer === 'controls' ? 'none' : 'controls')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeDrawer === 'controls' ? 'text-white underline underline-offset-4' : ''
            }`}
          >
            Controls
          </button>
          <button
            type="button"
            onClick={() => setActiveDrawer(activeDrawer === 'settings' ? 'none' : 'settings')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeDrawer === 'settings' ? 'text-white underline underline-offset-4' : ''
            }`}
          >
            Match Setup
          </button>
          <button
            type="button"
            onClick={() => onUpdateSettings({ soundEnabled: !settings.soundEnabled })}
            className="hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5"
          >
            {settings.soundEnabled ? (
              <Volume2 className="w-4 h-4 text-sky-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-400" />
            )}
            <span>{settings.soundEnabled ? 'Audio On' : 'Audio Muted'}</span>
          </button>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onStartMatch}
            className="px-4 py-2 text-xs font-semibold text-slate-950 bg-sky-400 rounded-lg hover:bg-sky-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Quick Kickoff
          </button>
        </div>
      </header>

      {/* Center Focal Anchor: Championship Matchup & Prominent Play Button */}
      <main className="my-auto w-full max-w-2xl mx-auto text-center flex flex-col items-center pointer-events-auto">
        <p className="text-xs font-medium tracking-wide text-sky-300 mb-2">
          5-v-5 Stadium Exhibition · {Math.round(settings.matchDurationSeconds / 60)} Min Match ·{' '}
          {settings.difficulty === 'pro'
            ? 'Pro AI'
            : settings.difficulty === 'standard'
            ? 'Standard AI'
            : 'Casual AI'}
        </p>

        <h1
          className="font-display font-bold text-white tracking-tight leading-none mb-4"
          style={{ fontSize: 'clamp(2.75rem, 6vw, 4.75rem)', textWrap: 'balance' }}
        >
          ARCADE STADIUM FOOTBALL
        </h1>

        {/* Clean Unboxed Matchup Line */}
        <div className="flex items-center justify-center gap-4 text-sm md:text-base font-medium text-slate-200 mb-8">
          <span className="flex items-center gap-2">
            <span
              className="inline-block w-3 h-3 rounded-xs"
              style={{ backgroundColor: homeTeam.primaryColor }}
            />
            <span>{homeTeam.name} (You)</span>
          </span>
          <span className="text-slate-400">vs</span>
          <span className="flex items-center gap-2">
            <span>{awayTeam.name}</span>
            <span
              className="inline-block w-3 h-3 rounded-xs"
              style={{ backgroundColor: awayTeam.primaryColor }}
            />
          </span>
        </div>

        {/* Primary Focal Play CTA */}
        <button
          type="button"
          onClick={onStartMatch}
          className="group relative inline-flex items-center justify-center gap-3 px-10 py-4 bg-sky-500 hover:bg-sky-400 active:scale-[0.98] text-slate-950 font-display font-bold text-2xl tracking-wide rounded-xl shadow-lg transition-all duration-150 cursor-pointer whitespace-nowrap shrink-0"
        >
          <Play className="w-6 h-6 fill-slate-950" />
          <span>PLAY MATCH</span>
        </button>

        {/* Mobile / Compact Secondary Toggles */}
        <div className="flex items-center justify-center gap-4 mt-5 sm:hidden">
          <button
            type="button"
            onClick={() => setActiveDrawer(activeDrawer === 'controls' ? 'none' : 'controls')}
            className="px-3.5 py-2 text-xs font-medium text-slate-200 bg-slate-900/90 border border-slate-700/80 rounded-lg whitespace-nowrap shrink-0"
          >
            Controls
          </button>
          <button
            type="button"
            onClick={() => setActiveDrawer(activeDrawer === 'settings' ? 'none' : 'settings')}
            className="px-3.5 py-2 text-xs font-medium text-slate-200 bg-slate-900/90 border border-slate-700/80 rounded-lg whitespace-nowrap shrink-0"
          >
            Match Setup
          </button>
        </div>

        {/* Expandable Settings or Controls Panel (Single Elevation, Solid Dark Surface) */}
        {activeDrawer === 'settings' && (
          <div className="mt-6 w-full max-w-md bg-slate-900/95 border border-slate-800 rounded-xl p-5 text-left shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <SlidersHorizontal className="w-4 h-4 text-sky-400" />
                <span>Match Configuration</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveDrawer('none')}
                className="text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Opponent Difficulty</label>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950 rounded-lg">
                  {(['casual', 'standard', 'pro'] as DifficultyLevel[]).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => onUpdateSettings({ difficulty: level })}
                      className={`py-1.5 px-3 text-xs font-medium rounded-md capitalize transition-colors cursor-pointer whitespace-nowrap ${
                        settings.difficulty === level
                          ? 'bg-sky-500 text-slate-950 font-semibold'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Match Duration</label>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950 rounded-lg">
                  {[
                    { label: '2 Min', sec: 120 },
                    { label: '3 Min', sec: 180 },
                    { label: '5 Min', sec: 300 },
                  ].map((opt) => (
                    <button
                      key={opt.sec}
                      type="button"
                      onClick={() => onUpdateSettings({ matchDurationSeconds: opt.sec })}
                      className={`py-1.5 px-3 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap font-mono-tabular ${
                        settings.matchDurationSeconds === opt.sec
                          ? 'bg-sky-500 text-slate-950 font-semibold'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Camera Perspective</label>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950 rounded-lg">
                  {(['broadcast', 'wide'] as const).map((cam) => (
                    <button
                      key={cam}
                      type="button"
                      onClick={() => onUpdateSettings({ cameraZoom: cam })}
                      className={`py-1.5 px-3 text-xs font-medium rounded-md capitalize transition-colors cursor-pointer whitespace-nowrap ${
                        settings.cameraZoom === cam
                          ? 'bg-sky-500 text-slate-950 font-semibold'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {cam === 'broadcast' ? 'Broadcast Oblique' : 'Wide Tactical'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeDrawer === 'controls' && (
          <div className="mt-6 w-full max-w-md bg-slate-900/95 border border-slate-800 rounded-xl p-5 text-left shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Keyboard className="w-4 h-4 text-sky-400" />
                <span>Keyboard & Touch Controls</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveDrawer('none')}
                className="text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Move Player</span>
                <span className="font-mono-tabular text-white">WASD or Arrow Keys / Left Joystick</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Pass / Tackle</span>
                <span className="font-mono-tabular text-white">X or J / Pass Button</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Shoot (Hold to Charge)</span>
                <span className="font-mono-tabular text-white">Space or K / Shoot Button</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Sprint</span>
                <span className="font-mono-tabular text-white">Shift / Sprint Button</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Switch Player / Lunge Tackle</span>
                <span className="font-mono-tabular text-white">Tab or C / Switch Button</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Quiet Footer Instruction */}
      <footer className="w-full max-w-6xl mx-auto flex items-center justify-between text-xs text-slate-400 pointer-events-auto">
        <span>WASD / Arrows to Move · X to Pass · Space to Shoot · Shift to Sprint</span>
        <span className="hidden sm:inline">Touch Joystick & Action Pad Ready</span>
      </footer>
    </div>
  );
}
