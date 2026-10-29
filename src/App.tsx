/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useRef } from 'react';
import { GameControls } from './components/GameControls';
import { MainMenu } from './components/MainMenu';
import { MatchResult } from './components/MatchResult';
import { PauseMenu } from './components/PauseMenu';
import { Scoreboard } from './components/Scoreboard';
import { useGameLifecycle } from './hooks/useGameLifecycle';

export default function App() {
  const threeContainerRef = useRef<HTMLDivElement | null>(null);
  const canvas2DRef = useRef<HTMLCanvasElement | null>(null);

  const {
    hud,
    settings,
    startMatch,
    togglePause,
    returnToMenu,
    cycleCamera,
    updateSettings,
    inputActions,
  } = useGameLifecycle(threeContainerRef, canvas2DRef);

  const isInMatch =
    hud.phase === 'KICKOFF' ||
    hud.phase === 'PLAYING' ||
    hud.phase === 'GOAL_CELEBRATION' ||
    hud.phase === 'OUT_OF_BOUNDS' ||
    hud.phase === 'PAUSED';

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-950 select-none">
      {/* 1. Background 3D Stadium Viewport (Three.js) */}
      <div
        ref={threeContainerRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      {/* 2. Synchronized Foreground 2D Football Gameplay Canvas (2D Players, Ball, Shadows) */}
      <canvas
        ref={canvas2DRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      {/* 3. Main Menu Overlay */}
      {hud.phase === 'MENU' && (
        <MainMenu
          homeTeam={hud.homeTeam}
          awayTeam={hud.awayTeam}
          settings={settings}
          onStartMatch={startMatch}
          onUpdateSettings={updateSettings}
        />
      )}

      {/* 4. Active Match HUD & Controller */}
      {isInMatch && (
        <>
          <Scoreboard
            hud={hud}
            onPause={togglePause}
            onToggleCamera={cycleCamera}
            cameraMode={settings.cameraMode}
          />
          <GameControls
            onJoystick={inputActions.setJoystick}
            onSprint={inputActions.setSprint}
            onShootStart={inputActions.shootStart}
            onShootEnd={inputActions.shootEnd}
            onPassStart={inputActions.passStart}
            onPassEnd={inputActions.passEnd}
            onSwitchOrTackle={inputActions.switchOrTackle}
          />
        </>
      )}

      {/* 5. Pause Overlay */}
      {hud.phase === 'PAUSED' && (
        <PauseMenu
          settings={settings}
          onResume={togglePause}
          onRestart={startMatch}
          onMainMenu={returnToMenu}
          onUpdateSettings={updateSettings}
        />
      )}

      {/* 6. Full-Time Match Result Screen */}
      {hud.phase === 'FULL_TIME' && (
        <MatchResult
          hud={hud}
          onRematch={startMatch}
          onMainMenu={returnToMenu}
        />
      )}
    </div>
  );
}
