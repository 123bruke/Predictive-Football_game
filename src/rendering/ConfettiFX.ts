import * as THREE from 'three';
import { PitchConfig, TeamId } from '../types/game';

interface ConfettiParticle {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rot: THREE.Vector3;
  rotSpeed: THREE.Vector3;
  color: number;
  scale: number;
}

export class ConfettiFX {
  public readonly group = new THREE.Group();
  private instancedMesh: THREE.InstancedMesh;
  private readonly particles: ConfettiParticle[] = [];
  private readonly dummy = new THREE.Object3D();
  private isExploding = false;
  private count = 300;

  constructor(pitch: PitchConfig) {
    const geo = new THREE.PlaneGeometry(0.24, 0.42);
    const mat = new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    this.instancedMesh = new THREE.InstancedMesh(geo, mat, this.count);
    this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.instancedMesh.frustumCulled = false;

    const palette = [0x38bdf8, 0xe11d48, 0xfacc15, 0x10b981, 0xf8fafc, 0xa855f7];
    const col = new THREE.Color();

    for (let i = 0; i < this.count; i++) {
      const color = palette[i % palette.length];
      col.setHex(color);
      this.instancedMesh.setColorAt(i, col);

      this.particles.push({
        pos: new THREE.Vector3(0, -100, 0),
        vel: new THREE.Vector3(),
        rot: new THREE.Vector3(Math.random() * Math.PI, Math.random() * Math.PI, 0),
        rotSpeed: new THREE.Vector3(
          (Math.random() - 0.5) * 8,
          (Math.random() - 0.5) * 8,
          (Math.random() - 0.5) * 8
        ),
        color,
        scale: 0.8 + Math.random() * 0.6,
      });
    }

    if (this.instancedMesh.instanceColor) {
      this.instancedMesh.instanceColor.needsUpdate = true;
    }
    this.group.add(this.instancedMesh);
  }

  public triggerGoal(scoringTeam: TeamId, goalX: number): void {
    this.isExploding = true;
    for (let i = 0; i < this.count; i++) {
      const p = this.particles[i];
      // Burst from behind the scoring goal mouth
      p.pos.set(
        goalX + (Math.random() - 0.5) * 6,
        1.5 + Math.random() * 2,
        (Math.random() - 0.5) * 14
      );
      const angle = Math.random() * Math.PI * 2;
      const speed = 12 + Math.random() * 22;
      p.vel.set(
        (Math.random() - 0.5) * speed * 0.8,
        14 + Math.random() * 18,
        (Math.random() - 0.5) * speed * 0.8
      );
    }
  }

  public reset(): void {
    this.isExploding = false;
    for (let i = 0; i < this.count; i++) {
      this.particles[i].pos.set(0, -100, 0);
      this.particles[i].vel.set(0, 0, 0);
    }
    this.updateMesh();
  }

  public update(dt: number): void {
    if (!this.isExploding) return;

    for (let i = 0; i < this.count; i++) {
      const p = this.particles[i];
      p.vel.y -= 18 * dt; // Gravity
      p.vel.x *= Math.pow(0.96, dt * 60); // Air drag
      p.vel.z *= Math.pow(0.96, dt * 60);

      p.pos.addScaledVector(p.vel, dt);
      p.rot.x += p.rotSpeed.x * dt;
      p.rot.y += p.rotSpeed.y * dt;
      p.rot.z += p.rotSpeed.z * dt;

      // Ground bounce
      if (p.pos.y < 0.05) {
        p.pos.y = 0.05;
        p.vel.y = -p.vel.y * 0.25;
      }
    }
    this.updateMesh();
  }

  private updateMesh(): void {
    for (let i = 0; i < this.count; i++) {
      const p = this.particles[i];
      this.dummy.position.copy(p.pos);
      this.dummy.rotation.set(p.rot.x, p.rot.y, p.rot.z);
      this.dummy.scale.set(p.scale, p.scale, p.scale);
      this.dummy.updateMatrix();
      this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }

  public dispose(): void {
    this.instancedMesh.geometry.dispose();
    (this.instancedMesh.material as THREE.Material).dispose();
  }
}
