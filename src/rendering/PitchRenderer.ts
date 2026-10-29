import { PitchConfig } from '../types/game';

export class PitchRenderer {
  /**
   * Generates a crisp, high-resolution 2D canvas of the football pitch, turf stripes,
   * and official pitch markings. Used both for the 3D pitch surface texture and 2D fallback.
   */
  public static createPitchCanvas(pitch: PitchConfig): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1360;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    const w = canvas.width;
    const h = canvas.height;

    // Outer surround (dark stadium technical apron + turf border)
    const totalWorldW = pitch.width + 16;
    const totalWorldH = pitch.height + 14;
    const scaleX = w / totalWorldW;
    const scaleY = h / totalWorldH;
    const cx = w * 0.5;
    const cy = h * 0.5;

    // Base rich turf green
    ctx.fillStyle = '#155e34';
    ctx.fillRect(0, 0, w, h);

    const pitchPxW = pitch.width * scaleX;
    const pitchPxH = pitch.height * scaleY;
    const left = cx - pitchPxW * 0.5;
    const top = cy - pitchPxH * 0.5;
    const right = cx + pitchPxW * 0.5;
    const bottom = cy + pitchPxH * 0.5;

    // Alternating mowed grass stripes inside playable pitch + 2.5m apron
    const stripeCount = 14;
    const stripeW = pitchPxW / stripeCount;
    for (let i = -1; i <= stripeCount; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#1b7340' : '#166337';
      ctx.fillRect(left + i * stripeW, top - scaleY * 2.2, stripeW + 1, pitchPxH + scaleY * 4.4);
    }

    // Subtle horizontal mower cross-grain
    ctx.fillStyle = 'rgba(255, 255, 255, 0.018)';
    const hStripes = 8;
    const hStripeH = pitchPxH / hStripes;
    for (let j = 0; j < hStripes; j += 2) {
      ctx.fillRect(left, top + j * hStripeH, pitchPxW, hStripeH);
    }

    // Crisp white pitch lines
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.92)';
    ctx.fillStyle = 'rgba(248, 250, 252, 0.92)';
    ctx.lineWidth = Math.max(4, scaleX * 0.16);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Outer boundary (touchlines + goal lines)
    ctx.strokeRect(left, top, pitchPxW, pitchPxH);

    // Halfway line
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.lineTo(cx, bottom);
    ctx.stroke();

    // Center circle & center spot
    const centerRad = pitch.centerCircleRadius * scaleX;
    ctx.beginPath();
    ctx.arc(cx, cy, centerRad, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, scaleX * 0.32, 0, Math.PI * 2);
    ctx.fill();

    // Left & Right Penalty Areas
    const penW = pitch.penaltyAreaW * scaleX;
    const penH = pitch.penaltyAreaH * scaleY;
    ctx.strokeRect(left, cy - penH * 0.5, penW, penH);
    ctx.strokeRect(right - penW, cy - penH * 0.5, penW, penH);

    // Left & Right Goal Areas (6-yard boxes)
    const goalAreaW = pitch.goalAreaW * scaleX;
    const goalAreaH = pitch.goalAreaH * scaleY;
    ctx.strokeRect(left, cy - goalAreaH * 0.5, goalAreaW, goalAreaH);
    ctx.strokeRect(right - goalAreaW, cy - goalAreaH * 0.5, goalAreaW, goalAreaH);

    // Penalty spots & D-arcs
    const penSpotOffset = pitch.penaltyAreaW * 0.72 * scaleX;
    const arcRadius = pitch.centerCircleRadius * 0.82 * scaleX;

    // Left penalty spot + arc
    ctx.beginPath();
    ctx.arc(left + penSpotOffset, cy, scaleX * 0.26, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(left + penSpotOffset, cy, arcRadius, -0.68, 0.68);
    ctx.stroke();

    // Right penalty spot + arc
    ctx.beginPath();
    ctx.arc(right - penSpotOffset, cy, scaleX * 0.26, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(right - penSpotOffset, cy, arcRadius, Math.PI - 0.68, Math.PI + 0.68);
    ctx.stroke();

    // 4 Corner arcs
    const cornerR = scaleX * 1.15;
    ctx.beginPath();
    ctx.arc(left, top, cornerR, 0, Math.PI * 0.5);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(right, top, cornerR, Math.PI * 0.5, Math.PI);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(right, bottom, cornerR, Math.PI, Math.PI * 1.5);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(left, bottom, cornerR, Math.PI * 1.5, Math.PI * 2);
    ctx.stroke();

    return canvas;
  }
}
