import { RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { GameEngine } from '../game/GameEngine';
import { GameLoop } from '../game/GameLoop';
import { PlayerRenderer } from '../rendering/PlayerRenderer';
import { ThreeScene } from '../rendering/ThreeScene';
import { MatchHUDState, MatchSettings } from '../types/game';

export interface GameLifecycleControls {
  hud: MatchHUDState;
  settings: MatchSettings;
  startMatch: () => void;
  togglePause: () => void;
  returnToMenu: () => void;
  updateSettings: (partial: Partial<MatchSettings>) => void;
  inputActions: {
    setJoystick: (x: number, y: number) => void;
    setSprint: (active: boolean) => void;
    shootStart: () => void;
    shootEnd: () => void;
    passStart: () => void;
    passEnd: () => void;
    switchOrTackle: () => void;
  };
}

export function useGameLifecycle(
  threeContainerRef: RefObject<HTMLDivElement | null>,
  canvas2DRef: RefObject<HTMLCanvasElement | null>
): GameLifecycleControls {
  const engineRef = useRef<GameEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new GameEngine();
  }

  const [hud, setHud] = useState<MatchHUDState>(() => engineRef.current!.getHudState());
  const [settings, setSettings] = useState<MatchSettings>(() => ({
    ...engineRef.current!.settings,
  }));

  useEffect(() => {
    const engine = engineRef.current!;
    const threeContainer = threeContainerRef.current;
    const canvas2D = canvas2DRef.current;
    if (!threeContainer || !canvas2D) return;

    engine.setHudCallback((newHud) => {
      setHud(newHud);
    });
    engine.input.attach();

    const threeScene = new ThreeScene(threeContainer, engine.pitch);
    const playerRenderer = new PlayerRenderer();
    const ctx2D = canvas2D.getContext('2d');

    const syncViewportSize = () => {
      const width = threeContainer.clientWidth || window.innerWidth;
      const height = threeContainer.clientHeight || window.innerHeight;
      const dpr = threeScene.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2);

      canvas2D.width = Math.round(width * dpr);
      canvas2D.height = Math.round(height * dpr);
      canvas2D.style.width = `${width}px`;
      canvas2D.style.height = `${height}px`;

      if (ctx2D) {
        ctx2D.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      threeScene.resize(width, height);
    };

    syncViewportSize();
    window.addEventListener('resize', syncViewportSize);

    const loop = new GameLoop(
      (dt) => {
        engine.update(dt);
        threeScene.updateAndRender(
          dt,
          engine.ball.state.x,
          engine.ball.state.y,
          engine.phase,
          engine.settings.cameraZoom
        );
        if (ctx2D) {
          const width = threeContainer.clientWidth || window.innerWidth;
          const height = threeContainer.clientHeight || window.innerHeight;
          playerRenderer.render(ctx2D, width, height, engine, threeScene);
        }
      },
      threeScene.isSoftwareGl,
      () => threeScene.getGlContext()
    );

    loop.start();

    return () => {
      loop.stop();
      window.removeEventListener('resize', syncViewportSize);
      threeScene.dispose();
      engine.dispose();
    };
  }, [threeContainerRef, canvas2DRef]);

  const startMatch = useCallback(() => {
    engineRef.current?.startNewMatch();
  }, []);

  const togglePause = useCallback(() => {
    engineRef.current?.togglePause();
  }, []);

  const returnToMenu = useCallback(() => {
    engineRef.current?.returnToMenu();
  }, []);

  const updateSettings = useCallback((partial: Partial<MatchSettings>) => {
    if (!engineRef.current) return;
    engineRef.current.updateSettings(partial);
    setSettings({ ...engineRef.current.settings });
  }, []);

  const inputActions = useRef({
    setJoystick: (x: number, y: number) => engineRef.current?.input.setTouchJoystick(x, y),
    setSprint: (active: boolean) => engineRef.current?.input.setTouchSprint(active),
    shootStart: () => engineRef.current?.input.triggerTouchShootStart(),
    shootEnd: () => engineRef.current?.input.triggerTouchShootEnd(),
    passStart: () => engineRef.current?.input.triggerTouchPassStart(),
    passEnd: () => engineRef.current?.input.triggerTouchPassEnd(),
    switchOrTackle: () => engineRef.current?.input.triggerTouchSwitchOrTackle(),
  }).current;

  return {
    hud,
    settings,
    startMatch,
    togglePause,
    returnToMenu,
    updateSettings,
    inputActions,
  };
}
