import * as THREE from 'three';
import { PitchConfig } from '../types/game';

export class VolumetricLighting {
  public readonly group = new THREE.Group();

  constructor(pitch: PitchConfig) {
    const corners = [
      { x: -(pitch.halfW + 13), z: -(pitch.halfH + 11) },
      { x: pitch.halfW + 13, z: -(pitch.halfH + 11) },
      { x: -(pitch.halfW + 13), z: pitch.halfH + 11 },
      { x: pitch.halfW + 13, z: pitch.halfH + 11 },
    ];

    const beamGeo = new THREE.ConeGeometry(18, 28, 16, 1, true);
    // Move pivot to tip of cone
    beamGeo.translate(0, -14, 0);

    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xfffbeb,
      transparent: true,
      opacity: 0.045,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    for (const c of corners) {
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(c.x, 26, c.z);
      // Aim beam toward pitch center / penalty areas
      const targetX = c.x > 0 ? pitch.halfW * 0.4 : -pitch.halfW * 0.4;
      const targetZ = c.z > 0 ? pitch.halfH * 0.3 : -pitch.halfH * 0.3;
      beam.lookAt(targetX, 0, targetZ);
      beam.rotateX(Math.PI * 0.5);
      this.group.add(beam);
    }
  }

  public dispose(): void {
    this.group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material.dispose();
        }
      }
    });
  }
}
