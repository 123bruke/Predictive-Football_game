import { GameEngine } from '../game/GameEngine';
import { AWAY_KIT, HOME_KIT } from '../game/Team';
import { ScreenProjection, ThreeScene } from './ThreeScene';

export class PlayerRenderer {
  private readonly projA: ScreenProjection = { x: 0, y: 0, scale: 1 };
  private readonly projB: ScreenProjection = { x: 0, y: 0, scale: 1 };

  /**
   * Renders tactical HUD overlays (Pass Receiver Ring, Kick Power Charge Arc,
   * Player Stamina Tag, and the Live 4D Tactical Radar Minimap) on the 2D canvas.
   */
  public render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    engine: GameEngine,
    threeScene: ThreeScene
  ): void {
    ctx.clearRect(0, 0, width, height);

    // If WebGL renderer failed to initialize, draw a clean 2D fallback pitch
    if (!threeScene.renderer) {
      this.drawFallbackPitch(ctx, width, height, engine, threeScene);
    }

    const controlled = engine.getControlledPlayer();
    const userHasBall = engine.ball.state.ownerId === controlled.state.id;

    // 1. Pass Receiver Ring on turf
    if (engine.phase === 'PLAYING' && userHasBall) {
      const targetMate = engine.findPassTarget(
        controlled,
        engine.input.state.moveX,
        engine.input.state.moveY
      );
      if (targetMate) {
        threeScene.worldToScreen(targetMate.state.x, targetMate.state.y, 0.05, this.projA);
        const rx = this.projA.scale * 1.35;
        const ry = rx * 0.58;
        ctx.save();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        ctx.ellipse(this.projA.x, this.projA.y, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Inner glowing receiver icon
        ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
        ctx.fill();
        ctx.restore();
      }
    }

    // 2. Kick / Pass Charge Meter & Facing Ring on turf
    if (engine.phase !== 'MENU') {
      const p = controlled.state;
      threeScene.worldToScreen(p.x, p.y, 0.04, this.projA);
      const groundX = this.projA.x;
      const groundY = this.projA.y;
      const s = this.projA.scale;

      const ringRx = s * 1.45;
      const ringRy = ringRx * 0.58;

      ctx.save();
      // Outer controlled ring
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = Math.max(2, s * 0.12);
      ctx.beginPath();
      ctx.ellipse(groundX, groundY, ringRx, ringRy, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Directional arrow on the ring edge
      const arrowAngle = p.angle;
      const tipX = groundX + Math.cos(arrowAngle) * (ringRx + s * 0.38);
      const tipY = groundY + Math.sin(arrowAngle) * (ringRy + s * 0.22);
      const leftX = groundX + Math.cos(arrowAngle - 0.35) * ringRx;
      const leftY = groundY + Math.sin(arrowAngle - 0.35) * ringRy;
      const rightX = groundX + Math.cos(arrowAngle + 0.35) * ringRx;
      const rightY = groundY + Math.sin(arrowAngle + 0.35) * ringRy;

      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(leftX, leftY);
      ctx.lineTo(rightX, rightY);
      ctx.closePath();
      ctx.fill();

      // Active Shot / Pass Power Arc
      const activeCharge = Math.max(engine.input.state.shootCharge, engine.input.state.passCharge);
      if (activeCharge > 0.02) {
        const isShoot = engine.input.state.shootCharge >= engine.input.state.passCharge;
        ctx.strokeStyle = isShoot ? '#fbbf24' : '#34d399';
        ctx.lineWidth = Math.max(4, s * 0.24);
        ctx.beginPath();
        ctx.ellipse(
          groundX,
          groundY,
          ringRx + s * 0.3,
          ringRy + s * 0.16,
          0,
          -Math.PI * 0.5,
          -Math.PI * 0.5 + activeCharge * Math.PI * 2
        );
        ctx.stroke();
      }

      // Overhead Stamina Bar & Player Tag
      threeScene.worldToScreen(p.x, p.y, 3.4, this.projB);
      if (p.stamina < 95) {
        const barW = Math.max(40, s * 1.8);
        const barH = 5;
        const barX = this.projB.x - barW * 0.5;
        const barY = this.projB.y - 12;

        // Background
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

        // Fill bar
        const fillW = (p.stamina / p.maxStamina) * barW;
        ctx.fillStyle = p.stamina > 40 ? '#38bdf8' : '#ef4444';
        ctx.fillRect(barX, barY, fillW, barH);
      }

      ctx.restore();
    }

    // 3. Ball Impact Waves
    for (let i = 0; i < engine.ball.impacts.length; i++) {
      const imp = engine.ball.impacts[i];
      if (!imp.active) continue;
      threeScene.worldToScreen(imp.x, imp.y, imp.z, this.projA);
      const rx = imp.radius * this.projA.scale * 0.6;
      const ry = rx * 0.58;
      ctx.save();
      ctx.globalAlpha = Math.max(0, imp.alpha);
      ctx.strokeStyle = imp.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(this.projA.x, this.projA.y, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 4. Live 4D Tactical Radar / Minimap (Bottom Left Corner)
    if (engine.phase !== 'MENU') {
      this.drawRadar(ctx, width, height, engine);
    }
  }

  /**
   * Draws a sleek modern tactical radar minimap showing all 10 players and ball in real-time.
   */
  private drawRadar(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    engine: GameEngine
  ): void {
    const radarW = 150;
    const radarH = 96;
    const padding = 16;
    const rx = padding;
    const ry = height - radarH - padding;

    ctx.save();
    // Glassmorphic radar background
    ctx.fillStyle = 'rgba(7, 11, 18, 0.82)';
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(rx, ry, radarW, radarH, 10);
    ctx.fill();
    ctx.stroke();

    // Pitch turf border
    const pitchPadding = 8;
    const pw = radarW - pitchPadding * 2;
    const ph = radarH - pitchPadding * 2;
    const px = rx + pitchPadding;
    const py = ry + pitchPadding;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
    ctx.fillRect(px, py, pw, ph);

    // Midfield line & center circle
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px + pw * 0.5, py);
    ctx.lineTo(px + pw * 0.5, py + ph);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(px + pw * 0.5, py + ph * 0.5, ph * 0.22, 0, Math.PI * 2);
    ctx.stroke();

    // Penalty Boxes
    const boxW = pw * 0.16;
    const boxH = ph * 0.52;
    ctx.strokeRect(px, py + (ph - boxH) * 0.5, boxW, boxH);
    ctx.strokeRect(px + pw - boxW, py + (ph - boxH) * 0.5, boxW, boxH);

    // Helper to map world coords (-halfW..halfW, -halfH..halfH) to radar pixels
    const mapX = (wx: number) => px + ((wx + engine.pitch.halfW) / engine.pitch.width) * pw;
    const mapY = (wy: number) => py + ((wy + engine.pitch.halfH) / engine.pitch.height) * ph;

    // Draw Players
    for (const p of engine.allPlayers) {
      const dotX = mapX(p.state.x);
      const dotY = mapY(p.state.y);
      const isControlled = p.state.id === engine.controlledPlayerId;

      ctx.fillStyle = p.state.team === 'home' ? '#38bdf8' : '#fb7185';
      ctx.beginPath();
      ctx.arc(dotX, dotY, isControlled ? 4.5 : 3, 0, Math.PI * 2);
      ctx.fill();

      if (isControlled) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(dotX, dotY, 6, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Draw Ball
    const bx = mapX(engine.ball.state.x);
    const by = mapY(engine.ball.state.y);
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(bx, by, 3.2, 0, Math.PI * 2);
    ctx.fill();

    // Radar Header
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.fillText('4D TACTICAL RADAR', rx + 10, ry + 16);

    ctx.restore();
  }

  private drawFallbackPitch(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    engine: GameEngine,
    threeScene: ThreeScene
  ): void {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, width, height);
  }
}
