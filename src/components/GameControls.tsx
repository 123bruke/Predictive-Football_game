import React, { useEffect, useRef, useState } from 'react';
import { Gamepad2, ChevronDown, ChevronUp } from 'lucide-react';

interface GameControlsProps {
  onJoystick: (x: number, y: number) => void;
  onSprint: (active: boolean) => void;
  onShootStart: () => void;
  onShootEnd: () => void;
  onPassStart: () => void;
  onPassEnd: () => void;
  onSwitchOrTackle: () => void;
}

export function GameControls({
  onJoystick,
  onSprint,
  onShootStart,
  onShootEnd,
  onPassStart,
  onPassEnd,
  onSwitchOrTackle,
}: GameControlsProps) {
  const [showTouchPad, setShowTouchPad] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      window.innerWidth < 900
    );
  });
  const [hudCollapsed, setHudCollapsed] = useState(false);

  // Virtual Joystick State
  const stickBaseRef = useRef<HTMLDivElement | null>(null);
  const activePointerId = useRef<number | null>(null);
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });
  const [sprintHeld, setSprintHeld] = useState(false);
  const [passHeld, setPassHeld] = useState(false);
  const [shootHeld, setShootHeld] = useState(false);

  useEffect(() => {
    const checkTouchViewport = () => {
      if (window.innerWidth < 860) {
        setShowTouchPad(true);
      }
    };
    window.addEventListener('resize', checkTouchViewport);
    return () => window.removeEventListener('resize', checkTouchViewport);
  }, []);

  const updateJoystickFromEvent = (clientX: number, clientY: number) => {
    const base = stickBaseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;
    const maxR = rect.width * 0.42;

    const dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clampedDist = Math.min(maxR, dist);
    const angle = Math.atan2(dy, dx);

    const ox = dist > 1 ? Math.cos(angle) * clampedDist : 0;
    const oy = dist > 1 ? Math.sin(angle) * clampedDist : 0;

    setKnobOffset({ x: ox, y: oy });
    onJoystick(ox / maxR, oy / maxR);
  };

  const handleStickDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    activePointerId.current = e.pointerId;
    updateJoystickFromEvent(e.clientX, e.clientY);
  };

  const handleStickMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    updateJoystickFromEvent(e.clientX, e.clientY);
  };

  const handleStickUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    activePointerId.current = null;
    setKnobOffset({ x: 0, y: 0 });
    onJoystick(0, 0);
  };

  return (
    <>
      {/* Virtual Touch Controller (Left Joystick + Right Action Cluster) */}
      {showTouchPad && (
        <div className="fixed inset-x-0 bottom-4 z-10 px-5 flex items-end justify-between pointer-events-none select-none">
          {/* Left: Smooth Virtual Analog Joystick */}
          <div
            ref={stickBaseRef}
            onPointerDown={handleStickDown}
            onPointerMove={handleStickMove}
            onPointerUp={handleStickUp}
            onPointerCancel={handleStickUp}
            className="relative w-32 h-32 md:w-36 md:h-36 rounded-full bg-slate-950/75 border-2 border-slate-700/80 flex items-center justify-center pointer-events-auto touch-none shadow-xl"
          >
            {/* Crosshair guide */}
            <div className="w-14 h-14 rounded-full border border-slate-800/90 pointer-events-none" />
            {/* Movable Stick Thumb Knob */}
            <div
              className="w-12 h-12 rounded-full bg-sky-400/90 border-2 border-white shadow-md pointer-events-none transition-transform duration-75"
              style={{
                transform: `translate3d(${knobOffset.x}px, ${knobOffset.y}px, 0)`,
              }}
            />
          </div>

          {/* Right: Ergonomic Football Action Pad (Pass, Shoot, Sprint, Switch) */}
          <div className="grid grid-cols-2 gap-2.5 pointer-events-auto touch-none">
            {/* Switch / Tackle Button */}
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                onSwitchOrTackle();
              }}
              className="w-16 h-14 md:w-20 md:h-14 rounded-xl bg-slate-900/90 active:bg-slate-800 border border-slate-700 text-slate-200 font-display font-bold text-sm tracking-wide flex flex-col items-center justify-center shadow-lg cursor-pointer"
            >
              <span>SWITCH</span>
              <span className="text-[10px] font-sans font-normal text-slate-400">Tackle</span>
            </button>

            {/* Sprint Hold Button */}
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                setSprintHeld(true);
                onSprint(true);
              }}
              onPointerUp={() => {
                setSprintHeld(false);
                onSprint(false);
              }}
              onPointerLeave={() => {
                if (sprintHeld) {
                  setSprintHeld(false);
                  onSprint(false);
                }
              }}
              onPointerCancel={() => {
                setSprintHeld(false);
                onSprint(false);
              }}
              className={`w-16 h-14 md:w-20 md:h-14 rounded-xl border font-display font-bold text-sm tracking-wide flex flex-col items-center justify-center shadow-lg cursor-pointer transition-colors ${
                sprintHeld
                  ? 'bg-amber-400 text-slate-950 border-amber-200'
                  : 'bg-slate-900/90 text-amber-300 border-amber-500/50'
              }`}
            >
              <span>SPRINT</span>
              <span className="text-[10px] font-sans font-normal opacity-80">Hold</span>
            </button>

            {/* Pass Button */}
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                setPassHeld(true);
                onPassStart();
              }}
              onPointerUp={() => {
                setPassHeld(false);
                onPassEnd();
              }}
              onPointerLeave={() => {
                if (passHeld) {
                  setPassHeld(false);
                  onPassEnd();
                }
              }}
              onPointerCancel={() => {
                setPassHeld(false);
                onPassEnd();
              }}
              className={`w-16 h-16 md:w-20 md:h-16 rounded-xl border font-display font-bold text-base tracking-wide flex flex-col items-center justify-center shadow-lg cursor-pointer transition-transform ${
                passHeld
                  ? 'bg-sky-400 text-slate-950 border-white scale-95'
                  : 'bg-sky-500/90 text-slate-950 border-sky-300'
              }`}
            >
              <span>PASS</span>
              <span className="text-[10px] font-sans font-semibold opacity-80">Key X</span>
            </button>

            {/* Shoot Button */}
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                setShootHeld(true);
                onShootStart();
              }}
              onPointerUp={() => {
                setShootHeld(false);
                onShootEnd();
              }}
              onPointerLeave={() => {
                if (shootHeld) {
                  setShootHeld(false);
                  onShootEnd();
                }
              }}
              onPointerCancel={() => {
                setShootHeld(false);
                onShootEnd();
              }}
              className={`w-16 h-16 md:w-20 md:h-16 rounded-xl border font-display font-bold text-base tracking-wide flex flex-col items-center justify-center shadow-lg cursor-pointer transition-transform ${
                shootHeld
                  ? 'bg-rose-500 text-white border-white scale-95'
                  : 'bg-rose-600/95 text-white border-rose-400'
              }`}
            >
              <span>SHOOT</span>
              <span className="text-[10px] font-sans font-medium opacity-90">Space</span>
            </button>
          </div>
        </div>
      )}

      {/* Collapsible Bottom Control Dock (Desktop Helper + Touch Controller Toggle) */}
      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-10 hidden md:flex flex-col items-center pointer-events-auto">
        <button
          type="button"
          onClick={() => setHudCollapsed(!hudCollapsed)}
          className="flex items-center gap-1 px-2.5 py-0.5 bg-slate-950/90 border border-b-0 border-slate-800 rounded-t-md text-[11px] text-slate-400 hover:text-white cursor-pointer"
        >
          {hudCollapsed ? (
            <>
              <ChevronUp className="w-3 h-3" />
              <span>Show Controls</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3" />
              <span>Hide Controls</span>
            </>
          )}
        </button>

        {!hudCollapsed && (
          <div className="flex items-center gap-4 px-4 py-2 bg-slate-950/92 border border-slate-800 rounded-xl text-xs text-slate-300 shadow-lg">
            <span>
              <strong className="text-white font-mono-tabular">WASD / Arrows</strong> Move
            </span>
            <span aria-hidden="true" className="text-slate-700">
              ·
            </span>
            <span>
              <strong className="text-sky-400 font-mono-tabular">X</strong> Pass
            </span>
            <span aria-hidden="true" className="text-slate-700">
              ·
            </span>
            <span>
              <strong className="text-rose-400 font-mono-tabular">Space</strong> Shoot
            </span>
            <span aria-hidden="true" className="text-slate-700">
              ·
            </span>
            <span>
              <strong className="text-amber-300 font-mono-tabular">Shift</strong> Sprint
            </span>
            <span aria-hidden="true" className="text-slate-700">
              ·
            </span>
            <span>
              <strong className="text-white font-mono-tabular">Tab</strong> Switch / Tackle
            </span>
            <span aria-hidden="true" className="text-slate-700">
              |
            </span>
            <button
              type="button"
              onClick={() => setShowTouchPad(!showTouchPad)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                showTouchPad
                  ? 'bg-sky-500 text-slate-950 font-semibold'
                  : 'bg-slate-900 text-slate-300 hover:text-white'
              }`}
            >
              <Gamepad2 className="w-3.5 h-3.5" />
              <span>{showTouchPad ? 'Hide Touch Pad' : 'Touch Pad'}</span>
            </button>
          </div>
        )}
      </div>
    </>
  );
}
