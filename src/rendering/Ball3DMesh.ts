import * as THREE from 'three';
import { BallState } from '../types/game';

export class Ball3DMesh {
  public readonly group = new THREE.Group();
  public readonly mesh: THREE.Mesh;
  public readonly shadowMesh: THREE.Mesh;
  private readonly trailPoints: THREE.Vector3[] = [];
  private readonly trailLine: THREE.Line;
  private readonly trailGeo: THREE.BufferGeometry;
  private ballTexture: THREE.CanvasTexture;

  constructor(radius = 0.72) {
    this.ballTexture = this.createSoccerBallTexture();

    const ballGeo = new THREE.SphereGeometry(radius, 32, 24);
    const ballMat = new THREE.MeshStandardMaterial({
      map: this.ballTexture,
      roughness: 0.35,
      metalness: 0.08,
    });

    this.mesh = new THREE.Mesh(ballGeo, ballMat);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = false;
    this.group.add(this.mesh);

    // Dynamic ground contact shadow
    const shadowGeo = new THREE.PlaneGeometry(radius * 2.4, radius * 2.4);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x030712,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    this.shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadowMesh.rotation.x = -Math.PI * 0.5;
    this.shadowMesh.position.y = 0.02;
    this.group.add(this.shadowMesh);

    // Glowing speed trail for fast power shots
    const maxTrail = 16;
    for (let i = 0; i < maxTrail; i++) {
      this.trailPoints.push(new THREE.Vector3());
    }
    this.trailGeo = new THREE.BufferGeometry().setFromPoints(this.trailPoints);
    const trailMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.65,
      linewidth: 3,
    });
    this.trailLine = new THREE.Line(this.trailGeo, trailMat);
    this.trailLine.frustumCulled = false;
    this.group.add(this.trailLine);
  }

  private createSoccerBallTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Clean white leather base
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, 512, 256);

      // Procedural classic black pentagonal patches
      ctx.fillStyle = '#0f172a';
      const drawPatch = (cx: number, cy: number, r: number) => {
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
          const x = cx + Math.cos(a) * r;
          const y = cy + Math.sin(a) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.stroke();
      };

      // Grid of pentagons
      const r = 26;
      for (let y = 32; y < 256; y += 72) {
        for (let x = 32; x < 512; x += 96) {
          const shift = (y % 144 === 32 ? 0 : 48);
          drawPatch(x + shift, y, r);
        }
      }

      // Seam stitch outlines
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      for (let x = 0; x < 512; x += 48) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 256);
        ctx.stroke();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  public update(ball: BallState, dt: number): void {
    const ballY = Math.max(ball.radius, ball.z + ball.radius);

    // Three.js world mapping: (pitchX, heightZ, pitchY)
    this.mesh.position.set(ball.x, ballY, ball.y);

    // Rolling rotation aligned with velocity
    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed > 0.05) {
      this.mesh.rotation.x += ball.vy * dt * 2.2;
      this.mesh.rotation.z -= ball.vx * dt * 2.2;
    }
    this.mesh.rotation.y += ball.spinSpeed * dt;

    // Soft ground shadow updates
    this.shadowMesh.position.set(ball.x, 0.03, ball.y);
    const heightFactor = Math.max(0, 1 - ball.z * 0.12);
    const scale = 1 + ball.z * 0.25;
    this.shadowMesh.scale.set(scale, scale, 1);
    (this.shadowMesh.material as THREE.MeshBasicMaterial).opacity = 0.55 * heightFactor;

    // Trail update for fast shots
    if (speed > 16) {
      this.trailLine.visible = true;
      this.trailPoints.pop();
      this.trailPoints.unshift(new THREE.Vector3(ball.x, ballY, ball.y));
      this.trailGeo.setFromPoints(this.trailPoints);
    } else {
      this.trailLine.visible = false;
    }
  }

  public dispose(): void {
    this.ballTexture.dispose();
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.shadowMesh.geometry.dispose();
    (this.shadowMesh.material as THREE.Material).dispose();
    this.trailGeo.dispose();
    (this.trailLine.material as THREE.Material).dispose();
  }
}

