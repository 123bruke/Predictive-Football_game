import { GameEngine } from '../game/GameEngine';
import { Player } from '../game/Player';
import { AWAY_KIT, HOME_KIT } from '../game/Team';
import { ScreenProjection, ThreeScene } from './ThreeScene';

interface RenderSortable {
  type: 'player' | 'ball';
  sortY: number;
  player?: Player;
}

export class PlayerRenderer {
  private readonly projA: ScreenProjection = { x: 0, y: 0, scale: 1 };
  private readonly projB: ScreenProjection = { x: 0, y: 0, scale: 1 };
  private readonly sortableList: RenderSortable[] = [];

  constructor() {
    for (let i = 0; i < 11; i++) {
      this.sortableList.push({ type: 'player', sortY: 0 });
    }
  }

  /**
   * Renders all 2D football players, the 2D ball, shadows, pass target indicators,
   * and kick charge gauges onto the foreground 2D canvas synchronized with the 3D stadium.
   */
  public render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    engine: GameEngine,
    threeScene: ThreeScene
  ): void {
    ctx.clearRect(0, 0, width, height);

    // If WebGL renderer failed to initialize, draw a clean 2D fallback pitch first
    if (!threeScene.renderer) {
      this.drawFallbackPitch(ctx, width, height, engine, threeScene);
    }

    const controlled = engine.getControlledPlayer();
    const userHasBall = engine.ball.state.ownerId === controlled.state.id;

    // 1. Draw Pass Receiver Highlight Ring on the turf when user has possession
    if (engine.phase === 'PLAYING' && userHasBall) {
      const targetMate = engine.findPassTarget(
        controlled,
        engine.input.state.moveX,
        engine.input.state.moveY
      );
      if (targetMate) {
        threeScene.worldToScreen(targetMate.state.x, targetMate.state.y, 0.02, this.projA);
        const rx = this.projA.scale * 1.15;
        const ry = rx * 0.56;
        ctx.save();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.72)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.ellipse(this.projA.x, this.projA.y, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 2. Draw Ball Impact Rings on the turf
    for (let i = 0; i < engine.ball.impacts.length; i++) {
      const imp = engine.ball.impacts[i];
      if (!imp.active) continue;
      threeScene.worldToScreen(imp.x, imp.y, imp.z, this.projA);
      const rx = imp.radius * this.projA.scale * 0.55;
      const ry = rx * 0.58;
      ctx.save();
      ctx.globalAlpha = Math.max(0, imp.alpha);
      ctx.strokeStyle = imp.color;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.ellipse(this.projA.x, this.projA.y, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 3. Populate and depth-sort all 10 players + 1 ball by pitch Y (painter's order)
    const players = engine.allPlayers;
    for (let i = 0; i < players.length; i++) {
      const item = this.sortableList[i];
      item.type = 'player';
      item.sortY = players[i].state.y;
      item.player = players[i];
    }
    const ballItem = this.sortableList[players.length];
    ballItem.type = 'ball';
    ballItem.sortY = engine.ball.state.y + 0.15;
    ballItem.player = undefined;

    this.sortableList.sort((a, b) => a.sortY - b.sortY);

    // 4. Draw sorted 2D entities
    for (let i = 0; i < this.sortableList.length; i++) {
      const item = this.sortableList[i];
      if (item.type === 'ball') {
        this.drawBall(ctx, engine, threeScene);
      } else if (item.player) {
        this.drawPlayer(
          ctx,
          item.player,
          item.player.state.id === engine.controlledPlayerId && engine.phase !== 'MENU',
          engine,
          threeScene
        );
      }
    }
  }

  private drawPlayer(
    ctx: CanvasRenderingContext2D,
    player: Player,
    isControlled: boolean,
    engine: GameEngine,
    threeScene: ThreeScene
  ): void {
    const p = player.state;
    const kit = p.team === 'home' ? HOME_KIT : AWAY_KIT;
    const shirtColor = p.role === 'GK' ? kit.gkColor : kit.primaryColor;

    // Celebration jump elevation
    const jumpZ =
      p.animState === 'celebrate'
        ? Math.abs(Math.sin(p.animPhase * 1.4)) * 1.1
        : 0;

    // Ground contact shadow projection
    threeScene.worldToScreen(p.x, p.y, 0.02, this.projA);
    const groundX = this.projA.x;
    const groundY = this.projA.y;
    const s = this.projA.scale;

    // Controlled Player Ring, Direction Arrow & Kick Power Gauge on turf
    if (isControlled) {
      const ringRx = s * 1.28;
      const ringRy = ringRx * 0.56;

      ctx.save();
      // Outer controlled halo
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = Math.max(2, s * 0.14);
      ctx.beginPath();
      ctx.ellipse(groundX, groundY, ringRx, ringRy, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Subtle inner fill
      ctx.fillStyle = 'rgba(56, 189, 248, 0.16)';
      ctx.fill();

      // Directional facing pointer on the ring edge
      const arrowAngle = p.angle;
      const tipX = groundX + Math.cos(arrowAngle) * (ringRx + s * 0.36);
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

      // Kick / Pass Charge Arc when holding Shoot or Pass
      const activeCharge = Math.max(engine.input.state.shootCharge, engine.input.state.passCharge);
      if (activeCharge > 0.02) {
        const isShoot = engine.input.state.shootCharge >= engine.input.state.passCharge;
        ctx.strokeStyle = isShoot ? '#fbbf24' : '#34d399';
        ctx.lineWidth = Math.max(3.5, s * 0.22);
        ctx.beginPath();
        ctx.ellipse(
          groundX,
          groundY,
          ringRx + s * 0.25,
          ringRy + s * 0.14,
          0,
          -Math.PI * 0.5,
          -Math.PI * 0.5 + activeCharge * Math.PI * 2
        );
        ctx.stroke();
      }
      ctx.restore();
    }

    // Player shadow on grass
    ctx.save();
    ctx.fillStyle = 'rgba(6, 12, 20, 0.45)';
    ctx.beginPath();
    ctx.ellipse(groundX, groundY, s * 0.78, s * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Project elevated character anchor (when jumping in celebration)
    threeScene.worldToScreen(p.x, p.y, jumpZ, this.projB);
    const px = this.projB.x;
    const py = this.projB.y;

    ctx.save();
    ctx.translate(px, py);

    const cosA = Math.cos(p.angle);
    const sinA = Math.sin(p.angle);
    const facingX = cosA * s * 0.22;

    // Stride animation cycle
    const isMoving = p.animState === 'walk' || p.animState === 'run' || p.animState === 'sprint';
    const strideAmp =
      p.animState === 'sprint'
        ? 0.46
        : p.animState === 'run'
        ? 0.36
        : p.animState === 'walk'
        ? 0.22
        : 0;
    const legSwing = isMoving ? Math.sin(p.animPhase) * s * strideAmp : 0;
    const bodyBob = isMoving ? Math.abs(Math.cos(p.animPhase)) * s * 0.14 : 0;

    // Tackle slide tilt
    if (p.animState === 'tackle' && p.actionTimer > 0) {
      ctx.rotate(cosA >= 0 ? 0.32 : -0.32);
    }

    // 1. Football Boots & Socks (Left & Right legs)
    const legSpread = s * 0.24;
    const leftFootX = -legSpread + cosA * legSwing;
    const leftFootY = -s * 0.12 + sinA * legSwing * 0.5;
    const rightFootX = legSpread - cosA * legSwing;
    const rightFootY = -s * 0.12 - sinA * legSwing * 0.5;

    // Kick leg extension on pass/shoot
    const kickOffset =
      (p.animState === 'shoot' || p.animState === 'pass') && p.actionTimer > 0
        ? s * 0.48
        : 0;

    // Socks
    ctx.strokeStyle = kit.socksColor;
    ctx.lineWidth = Math.max(2.5, s * 0.22);
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(-legSpread * 0.8, -s * 0.55 - bodyBob);
    ctx.lineTo(leftFootX, leftFootY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(legSpread * 0.8, -s * 0.55 - bodyBob);
    ctx.lineTo(rightFootX + cosA * kickOffset, rightFootY + sinA * kickOffset * 0.5);
    ctx.stroke();

    // Boots
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.ellipse(leftFootX + cosA * s * 0.08, leftFootY, s * 0.18, s * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(
      rightFootX + cosA * (s * 0.08 + kickOffset),
      rightFootY + sinA * kickOffset * 0.5,
      s * 0.18,
      s * 0.11,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // 2. Shorts
    ctx.fillStyle = kit.shortsColor;
    ctx.beginPath();
    ctx.roundRect(-s * 0.42, -s * 0.85 - bodyBob, s * 0.84, s * 0.38, s * 0.12);
    ctx.fill();

    // 3. Torso / Team Jersey
    const torsoTop = -s * 1.56 - bodyBob;
    const torsoW = s * 0.92;
    const torsoH = s * 0.82;

    ctx.fillStyle = shirtColor;
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.65)';
    ctx.lineWidth = Math.max(1.2, s * 0.08);
    ctx.beginPath();
    ctx.roundRect(-torsoW * 0.5, torsoTop, torsoW, torsoH, s * 0.24);
    ctx.fill();
    ctx.stroke();

    // Shoulder / Collar Trim
    ctx.fillStyle = kit.secondaryColor;
    ctx.beginPath();
    ctx.roundRect(-torsoW * 0.42, torsoTop + s * 0.04, torsoW * 0.84, s * 0.14, s * 0.06);
    ctx.fill();

    // 4. Swinging Arms (raised high during Goal Celebration!)
    const armSwing = isMoving ? -legSwing * 0.85 : 0;
    const celebrateRaise = p.animState === 'celebrate' ? -s * 0.65 : 0;

    ctx.strokeStyle = p.skinTone;
    ctx.lineWidth = Math.max(2.2, s * 0.19);
    ctx.beginPath();
    ctx.moveTo(-torsoW * 0.52, torsoTop + s * 0.2);
    ctx.lineTo(-torsoW * 0.66 - armSwing * 0.5, torsoTop + s * 0.62 + celebrateRaise + armSwing * 0.4);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(torsoW * 0.52, torsoTop + s * 0.2);
    ctx.lineTo(torsoW * 0.66 + armSwing * 0.5, torsoTop + s * 0.62 + celebrateRaise - armSwing * 0.4);
    ctx.stroke();

    // 5. Jersey Number
    ctx.fillStyle = kit.secondaryColor;
    ctx.font = `700 ${Math.max(9, Math.round(s * 0.48))}px "Barlow Condensed", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(p.number), -facingX * 0.35, torsoTop + torsoH * 0.56);

    // 6. Head & Hair
    const headY = torsoTop - s * 0.34;
    const headR = s * 0.38;

    ctx.fillStyle = p.skinTone;
    ctx.beginPath();
    ctx.arc(facingX * 0.35, headY, headR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Hair cap
    ctx.fillStyle = p.hairColor;
    ctx.beginPath();
    ctx.arc(
      facingX * 0.2,
      headY - headR * 0.18,
      headR * 0.96,
      Math.PI * 0.85,
      Math.PI * 2.15
    );
    ctx.fill();

    // 7. Controlled Player Floating Nameplate & Stamina Bar
    if (isControlled) {
      const labelY = headY - headR - s * 0.55;
      ctx.font = `600 ${Math.max(10, Math.round(s * 0.44))}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillStyle = '#f8fafc';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowBlur = 4;
      ctx.fillText(p.name, 0, labelY);
      ctx.shadowBlur = 0;

      // Compact stamina bar underneath nameplate
      const barW = s * 1.1;
      const barH = Math.max(2.5, s * 0.12);
      const staminaRatio = Math.max(0, Math.min(1, p.stamina / p.maxStamina));
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.fillRect(-barW * 0.5, labelY + s * 0.24, barW, barH);
      ctx.fillStyle = staminaRatio > 0.3 ? '#38bdf8' : '#f59e0b';
      ctx.fillRect(-barW * 0.5, labelY + s * 0.24, barW * staminaRatio, barH);
    }

    ctx.restore();
  }

  private drawBall(
    ctx: CanvasRenderingContext2D,
    engine: GameEngine,
    threeScene: ThreeScene
  ): void {
    const b = engine.ball.state;

    // 1. Motion trail for fast passes & shots
    for (let i = b.trail.length - 1; i >= 1; i--) {
      const tp = b.trail[i];
      if (tp.alpha <= 0.03) continue;
      threeScene.worldToScreen(tp.x, tp.y, tp.z + b.radius * 0.5, this.projA);
      const r = this.projA.scale * b.radius * (1 - i / (b.trail.length + 2)) * 0.55;
      ctx.save();
      ctx.fillStyle = `rgba(248, 250, 252, ${tp.alpha * 0.45})`;
      ctx.beginPath();
      ctx.arc(this.projA.x, this.projA.y, Math.max(1.5, r), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 2. Ball shadow on the turf (shrinks and softens when ball is lofted in the air)
    threeScene.worldToScreen(b.x, b.y, 0.02, this.projA);
    const heightScale = Math.max(0.45, 1 - b.z * 0.09);
    const shadowRx = this.projA.scale * b.radius * 0.75 * heightScale;
    const shadowRy = shadowRx * 0.58;

    ctx.save();
    ctx.fillStyle = `rgba(6, 12, 20, ${0.52 * heightScale})`;
    ctx.beginPath();
    ctx.ellipse(this.projA.x, this.projA.y, shadowRx, shadowRy, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3. Ball body at current height z
    threeScene.worldToScreen(b.x, b.y, b.z + b.radius * 0.55, this.projB);
    const bx = this.projB.x;
    const by = this.projB.y;
    const br = Math.max(4.5, this.projB.scale * b.radius * 0.66);

    ctx.save();
    ctx.translate(bx, by);

    // Base white sphere with subtle shading
    const grad = ctx.createRadialGradient(-br * 0.3, -br * 0.35, br * 0.1, 0, 0, br);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.72, '#f1f5f9');
    grad.addColorStop(1, '#94a3b8');

    ctx.fillStyle = grad;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = Math.max(1.1, br * 0.16);
    ctx.beginPath();
    ctx.arc(0, 0, br, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Rotating pentagon panels
    ctx.fillStyle = '#1e293b';
    const rot = b.spinAngle;
    const panelR = br * 0.32;
    ctx.beginPath();
    ctx.arc(Math.cos(rot) * br * 0.25, Math.sin(rot) * br * 0.25, panelR, 0, Math.PI * 2);
    ctx.fill();

    for (let k = 0; k < 3; k++) {
      const a = rot + (k * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * br * 0.68, Math.sin(a) * br * 0.68, panelR * 0.65, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawFallbackPitch(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    engine: GameEngine,
    threeScene: ThreeScene
  ): void {
    ctx.fillStyle = '#0b131e';
    ctx.fillRect(0, 0, width, height);

    const p = engine.pitch;
    const corners = [
      { x: -p.halfW, y: -p.halfH },
      { x: p.halfW, y: -p.halfH },
      { x: p.halfW, y: p.halfH },
      { x: -p.halfW, y: p.halfH },
    ];
    ctx.fillStyle = '#166534';
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    corners.forEach((c, idx) => {
      threeScene.worldToScreen(c.x, c.y, 0, this.projA);
      if (idx === 0) ctx.moveTo(this.projA.x, this.projA.y);
      else ctx.lineTo(this.projA.x, this.projA.y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}
