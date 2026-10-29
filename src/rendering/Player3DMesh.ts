import * as THREE from 'three';
import { MatchPhase, PlayerState, TeamKit } from '../types/game';

export class Player3DMesh {
  public readonly root = new THREE.Group();
  public readonly id: string;

  private torso: THREE.Mesh;
  private head: THREE.Mesh;
  private hair: THREE.Mesh;
  private shorts: THREE.Mesh;

  private leftLegGroup = new THREE.Group();
  private rightLegGroup = new THREE.Group();
  private leftArmGroup = new THREE.Group();
  private rightArmGroup = new THREE.Group();

  private indicatorMesh: THREE.Mesh;
  private shadowMesh: THREE.Mesh;
  private jerseyTexture: THREE.CanvasTexture;

  constructor(player: PlayerState, kit: TeamKit) {
    this.id = player.id;
    const isGK = player.role === 'GK';
    const primaryColor = isGK ? kit.gkColor : kit.primaryColor;
    const accentColor = kit.accentColor;
    const shortsColor = kit.shortsColor;
    const socksColor = kit.socksColor;

    // 1. Procedural Jersey Texture with number
    this.jerseyTexture = this.createJerseyTexture(primaryColor, accentColor, player.number);

    const jerseyMat = new THREE.MeshStandardMaterial({
      map: this.jerseyTexture,
      roughness: 0.65,
      metalness: 0.1,
    });

    const skinMat = new THREE.MeshStandardMaterial({
      color: player.skinTone || '#f1c27d',
      roughness: 0.8,
      metalness: 0.05,
    });

    const hairMat = new THREE.MeshStandardMaterial({
      color: player.hairColor || '#18181b',
      roughness: 0.9,
      metalness: 0.05,
    });

    const shortsMat = new THREE.MeshStandardMaterial({
      color: shortsColor,
      roughness: 0.7,
      metalness: 0.05,
    });

    const socksMat = new THREE.MeshStandardMaterial({
      color: socksColor,
      roughness: 0.65,
      metalness: 0.05,
    });

    const bootMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.4,
      metalness: 0.3,
    });

    // 2. Torso (Chest & Back)
    const torsoGeo = new THREE.BoxGeometry(0.88, 0.96, 0.46);
    this.torso = new THREE.Mesh(torsoGeo, jerseyMat);
    this.torso.position.y = 1.48;
    this.torso.castShadow = true;
    this.torso.receiveShadow = true;
    this.root.add(this.torso);

    // 3. Head & Hair
    const headGeo = new THREE.SphereGeometry(0.3, 16, 14);
    this.head = new THREE.Mesh(headGeo, skinMat);
    this.head.position.y = 2.22;
    this.head.castShadow = true;
    this.root.add(this.head);

    const hairGeo = new THREE.SphereGeometry(0.32, 14, 10);
    this.hair = new THREE.Mesh(hairGeo, hairMat);
    this.hair.position.set(0, 2.28, -0.04);
    this.hair.scale.set(1.02, 0.95, 1.05);
    this.hair.castShadow = true;
    this.root.add(this.hair);

    // 4. Shorts (Hips)
    const shortsGeo = new THREE.BoxGeometry(0.86, 0.48, 0.46);
    this.shorts = new THREE.Mesh(shortsGeo, shortsMat);
    this.shorts.position.y = 0.96;
    this.shorts.castShadow = true;
    this.root.add(this.shorts);

    // 5. Left Leg (Hip Joint pivot at top of thigh)
    this.leftLegGroup.position.set(-0.24, 0.88, 0);
    const leftThigh = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.42, 0.36), shortsMat);
    leftThigh.position.y = -0.21;
    leftThigh.castShadow = true;
    this.leftLegGroup.add(leftThigh);

    const leftCalf = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.44, 0.32), socksMat);
    leftCalf.position.y = -0.58;
    leftCalf.castShadow = true;
    this.leftLegGroup.add(leftCalf);

    const leftBoot = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.44), bootMat);
    leftBoot.position.set(0, -0.82, 0.08);
    leftBoot.castShadow = true;
    this.leftLegGroup.add(leftBoot);
    this.root.add(this.leftLegGroup);

    // 6. Right Leg
    this.rightLegGroup.position.set(0.24, 0.88, 0);
    const rightThigh = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.42, 0.36), shortsMat);
    rightThigh.position.y = -0.21;
    rightThigh.castShadow = true;
    this.rightLegGroup.add(rightThigh);

    const rightCalf = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.44, 0.32), socksMat);
    rightCalf.position.y = -0.58;
    rightCalf.castShadow = true;
    this.rightLegGroup.add(rightCalf);

    const rightBoot = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.44), bootMat);
    rightBoot.position.set(0, -0.82, 0.08);
    rightBoot.castShadow = true;
    this.rightLegGroup.add(rightBoot);
    this.root.add(this.rightLegGroup);

    // 7. Left Arm (Shoulder pivot)
    this.leftArmGroup.position.set(-0.54, 1.84, 0);
    const leftSleeve = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.35, 0.28), jerseyMat);
    leftSleeve.position.y = -0.16;
    leftSleeve.castShadow = true;
    this.leftArmGroup.add(leftSleeve);

    const leftHand = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.44, 0.24), isGK ? jerseyMat : skinMat);
    leftHand.position.y = -0.48;
    leftHand.castShadow = true;
    this.leftArmGroup.add(leftHand);
    this.root.add(this.leftArmGroup);

    // 8. Right Arm
    this.rightArmGroup.position.set(0.54, 1.84, 0);
    const rightSleeve = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.35, 0.28), jerseyMat);
    rightSleeve.position.y = -0.16;
    rightSleeve.castShadow = true;
    this.rightArmGroup.add(rightSleeve);

    const rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.44, 0.24), isGK ? jerseyMat : skinMat);
    rightHand.position.y = -0.48;
    rightHand.castShadow = true;
    this.rightArmGroup.add(rightHand);
    this.root.add(this.rightArmGroup);

    // 9. Floating 3D Active Player Neon Chevron / Diamond
    const indGeo = new THREE.ConeGeometry(0.32, 0.62, 4);
    const indMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: false,
    });
    this.indicatorMesh = new THREE.Mesh(indGeo, indMat);
    this.indicatorMesh.rotation.x = Math.PI; // point downwards toward player head
    this.indicatorMesh.position.y = 3.05;
    this.indicatorMesh.visible = false;
    this.root.add(this.indicatorMesh);

    // 10. Ground Contact Shadow
    const shadowGeo = new THREE.PlaneGeometry(1.6, 1.6);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x070d17,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
    });
    this.shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadowMesh.rotation.x = -Math.PI * 0.5;
    this.shadowMesh.position.y = 0.02;
    this.root.add(this.shadowMesh);
  }

  private createJerseyTexture(primaryColor: string, accentColor: string, number: number): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Primary shirt background
      ctx.fillStyle = primaryColor;
      ctx.fillRect(0, 0, 256, 256);

      // Accent chest / shoulder diagonal trim
      ctx.fillStyle = accentColor;
      ctx.fillRect(0, 0, 256, 36);
      ctx.fillRect(20, 36, 28, 220);
      ctx.fillRect(208, 36, 28, 220);

      // Player Number in bold athletic font
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 110px "Barlow Condensed", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(number), 128, 140);

      // Shadow stroke for contrast
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 6;
      ctx.strokeText(String(number), 128, 140);
      ctx.fillText(String(number), 128, 140);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  public update(player: PlayerState, isControlled: boolean, dt: number, phase: MatchPhase, elapsed: number): void {
    // 1. Position & Orientation
    // In Three.js: (pitchX, heightY, pitchZ)
    const jumpY = player.animState === 'celebrate' ? Math.abs(Math.sin(player.animPhase * 1.6)) * 0.9 : 0;
    this.root.position.set(player.x, jumpY, player.y);

    // Smooth rotational facing
    this.root.rotation.y = -player.angle + Math.PI * 0.5;

    // 2. Controlled Indicator
    this.indicatorMesh.visible = isControlled && phase !== 'MENU';
    if (this.indicatorMesh.visible) {
      this.indicatorMesh.position.y = 3.05 + Math.sin(elapsed * 4.5) * 0.12;
      this.indicatorMesh.rotation.y += dt * 3.2;
    }

    // 3. Procedural Limb Animation
    const speed = Math.hypot(player.vx, player.vy);
    const isMoving = speed > 0.8;
    const stride = player.animState === 'sprint' ? 0.75 : player.animState === 'run' ? 0.55 : 0.35;

    if (player.animState === 'celebrate') {
      // Victory celebration: Jump with arms held high cheering!
      this.leftArmGroup.rotation.z = -2.4;
      this.rightArmGroup.rotation.z = 2.4;
      this.leftArmGroup.rotation.x = Math.sin(elapsed * 6) * 0.4;
      this.rightArmGroup.rotation.x = -Math.sin(elapsed * 6) * 0.4;
      this.leftLegGroup.rotation.x = 0.2;
      this.rightLegGroup.rotation.x = -0.2;
      this.torso.position.y = 1.48 + jumpY;
    } else if (player.animState === 'tackle') {
      // Slide tackle: slide along turf
      this.leftLegGroup.rotation.x = -1.2;
      this.rightLegGroup.rotation.x = 0.8;
      this.leftArmGroup.rotation.x = 1.1;
      this.rightArmGroup.rotation.x = -1.1;
      this.torso.rotation.x = 0.35;
    } else if (player.animState === 'shoot' || player.animState === 'pass') {
      // Dynamic kick: swing dominant leg forward
      this.rightLegGroup.rotation.x = -1.15;
      this.leftLegGroup.rotation.x = 0.45;
      this.leftArmGroup.rotation.x = -0.85;
      this.rightArmGroup.rotation.x = 0.75;
    } else if (isMoving) {
      // Running / sprinting cycle
      const swing = Math.sin(player.animPhase) * stride;
      this.leftLegGroup.rotation.x = swing;
      this.rightLegGroup.rotation.x = -swing;
      this.leftArmGroup.rotation.x = -swing * 0.85;
      this.rightArmGroup.rotation.x = swing * 0.85;
      this.leftArmGroup.rotation.z = 0;
      this.rightArmGroup.rotation.z = 0;
      this.torso.rotation.x = 0.12; // Athletic forward lean
      this.torso.position.y = 1.48 + Math.abs(Math.sin(player.animPhase * 2)) * 0.06;
    } else {
      // Idle breathing stance
      this.leftLegGroup.rotation.x = 0;
      this.rightLegGroup.rotation.x = 0;
      this.leftArmGroup.rotation.x = 0;
      this.rightArmGroup.rotation.x = 0;
      this.leftArmGroup.rotation.z = 0;
      this.rightArmGroup.rotation.z = 0;
      this.torso.rotation.x = 0;
      this.torso.position.y = 1.48 + Math.sin(elapsed * 2) * 0.02;
    }
  }

  public dispose(): void {
    this.jerseyTexture.dispose();
    this.root.traverse((obj) => {
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

