import * as THREE from 'three';
import { MatchPhase, PitchConfig, TeamId } from '../types/game';
import { PitchRenderer } from './PitchRenderer';

export class StadiumRenderer {
  public readonly stadiumGroup = new THREE.Group();
  private crowdInstanced: THREE.InstancedMesh | null = null;
  private crowdBaseMatrices: THREE.Matrix4[] = [];
  private pitchTexture: THREE.CanvasTexture | null = null;
  private netTexture: THREE.CanvasTexture | null = null;
  private adTexture: THREE.CanvasTexture | null = null;
  private readonly dummyObj = new THREE.Object3D();

  constructor(pitch: PitchConfig, maxAnisotropy: number) {
    this.buildPitchAndSurround(pitch, maxAnisotropy);
    this.buildGoals(pitch);
    this.buildPerimeterAndBenches(pitch, maxAnisotropy);
    this.buildGrandstandsAndCrowd(pitch);
    this.buildFloodlightTowers(pitch);
  }

  private buildPitchAndSurround(pitch: PitchConfig, maxAnisotropy: number): void {
    // 1. Dark stadium outer bowl floor
    const outerGeo = new THREE.PlaneGeometry(240, 180);
    const outerMat = new THREE.MeshStandardMaterial({
      color: 0x0b131e,
      roughness: 0.92,
      metalness: 0.05,
    });
    const outerMesh = new THREE.Mesh(outerGeo, outerMat);
    outerMesh.rotation.x = -Math.PI * 0.5;
    outerMesh.position.y = -0.08;
    outerMesh.receiveShadow = true;
    this.stadiumGroup.add(outerMesh);

    // 2. Athletic track / Tartan technical surround apron
    const trackGeo = new THREE.PlaneGeometry(pitch.width + 24, pitch.height + 20);
    const trackMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.85,
      metalness: 0.08,
    });
    const trackMesh = new THREE.Mesh(trackGeo, trackMat);
    trackMesh.rotation.x = -Math.PI * 0.5;
    trackMesh.position.y = -0.03;
    trackMesh.receiveShadow = true;
    this.stadiumGroup.add(trackMesh);

    // 3. Main Football Pitch with high-resolution procedural CanvasTexture
    const pitchCanvas = PitchRenderer.createPitchCanvas(pitch);
    this.pitchTexture = new THREE.CanvasTexture(pitchCanvas);
    this.pitchTexture.colorSpace = THREE.SRGBColorSpace;
    this.pitchTexture.anisotropy = maxAnisotropy;

    const totalWorldW = pitch.width + 16;
    const totalWorldH = pitch.height + 14;
    const pitchGeo = new THREE.PlaneGeometry(totalWorldW, totalWorldH);
    const pitchMat = new THREE.MeshStandardMaterial({
      map: this.pitchTexture,
      roughness: 0.78,
      metalness: 0.02,
    });
    const pitchMesh = new THREE.Mesh(pitchGeo, pitchMat);
    pitchMesh.rotation.x = -Math.PI * 0.5;
    pitchMesh.position.y = 0;
    pitchMesh.receiveShadow = true;
    this.stadiumGroup.add(pitchMesh);
  }

  private createNetTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 128, 128);
      ctx.strokeStyle = 'rgba(241, 245, 249, 0.55)';
      ctx.lineWidth = 3;
      const step = 16;
      for (let i = 0; i <= 128; i += step) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 128);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(128, i);
        ctx.stroke();
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 3);
    return tex;
  }

  private buildGoals(pitch: PitchConfig): void {
    this.netTexture = this.createNetTexture();

    const postMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.25,
      metalness: 0.4,
    });
    const stanchionMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.5,
      metalness: 0.7,
    });
    const netMat = new THREE.MeshBasicMaterial({
      map: this.netTexture,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const halfGoalZ = pitch.goalWidth * 0.5;
    const gh = pitch.goalHeight;
    const gd = pitch.goalDepth;
    const r = 0.14;

    const createGoalGroup = (side: -1 | 1): THREE.Group => {
      const group = new THREE.Group();
      const goalX = side * pitch.halfW;
      const backX = side * (pitch.halfW + gd);

      // Left & right upright posts
      const postGeo = new THREE.CylinderGeometry(r, r, gh, 12);
      const post1 = new THREE.Mesh(postGeo, postMat);
      post1.position.set(goalX, gh * 0.5, -halfGoalZ);
      post1.castShadow = true;
      group.add(post1);

      const post2 = new THREE.Mesh(postGeo, postMat);
      post2.position.set(goalX, gh * 0.5, halfGoalZ);
      post2.castShadow = true;
      group.add(post2);

      // Crossbar
      const crossbarGeo = new THREE.CylinderGeometry(r, r, pitch.goalWidth + r * 2, 12);
      const crossbar = new THREE.Mesh(crossbarGeo, postMat);
      crossbar.rotation.x = Math.PI * 0.5;
      crossbar.position.set(goalX, gh, 0);
      crossbar.castShadow = true;
      group.add(crossbar);

      // Back base frame & stanchions
      const backBar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, pitch.goalWidth, 8),
        stanchionMat
      );
      backBar.rotation.x = Math.PI * 0.5;
      backBar.position.set(backX, 0.08, 0);
      group.add(backBar);

      // Net panels (Back, Top, and 2 Sides)
      const backNet = new THREE.Mesh(new THREE.PlaneGeometry(pitch.goalWidth, gh), netMat);
      backNet.rotation.y = Math.PI * 0.5;
      backNet.position.set(backX, gh * 0.5, 0);
      group.add(backNet);

      const topNet = new THREE.Mesh(new THREE.PlaneGeometry(gd, pitch.goalWidth), netMat);
      topNet.rotation.x = Math.PI * 0.5;
      topNet.position.set(goalX + side * gd * 0.5, gh, 0);
      group.add(topNet);

      const sideNetGeo = new THREE.PlaneGeometry(gd, gh);
      const sideNet1 = new THREE.Mesh(sideNetGeo, netMat);
      sideNet1.position.set(goalX + side * gd * 0.5, gh * 0.5, -halfGoalZ);
      group.add(sideNet1);

      const sideNet2 = new THREE.Mesh(sideNetGeo, netMat);
      sideNet2.position.set(goalX + side * gd * 0.5, gh * 0.5, halfGoalZ);
      group.add(sideNet2);

      return group;
    };

    this.stadiumGroup.add(createGoalGroup(-1));
    this.stadiumGroup.add(createGoalGroup(1));
  }

  private buildPerimeterAndBenches(pitch: PitchConfig, maxAnisotropy: number): void {
    // Procedural LED Advertising Board Texture
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 1024, 64);
      const banners = [
        { bg: '#0284c7', text: 'PITCHSIDE 5V5 ARENA' },
        { bg: '#0f172a', text: 'CHAMPIONS STADIUM SERIES' },
        { bg: '#e11d48', text: 'MATCHDAY LIVE BROADCAST' },
        { bg: '#047857', text: 'PRO CLUB TOURNAMENT' },
      ];
      const segW = 1024 / banners.length;
      ctx.font = 'bold 28px "Barlow Condensed", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      banners.forEach((b, i) => {
        ctx.fillStyle = b.bg;
        ctx.fillRect(i * segW + 4, 6, segW - 8, 52);
        ctx.fillStyle = '#f8fafc';
        ctx.fillText(b.text, i * segW + segW * 0.5, 34);
      });
    }
    this.adTexture = new THREE.CanvasTexture(canvas);
    this.adTexture.colorSpace = THREE.SRGBColorSpace;
    this.adTexture.anisotropy = maxAnisotropy;
    this.adTexture.wrapS = THREE.RepeatWrapping;
    this.adTexture.repeat.set(3, 1);

    const adMat = new THREE.MeshStandardMaterial({
      map: this.adTexture,
      roughness: 0.4,
      metalness: 0.1,
      emissive: new THREE.Color(0x1e293b),
      emissiveIntensity: 0.45,
    });

    const boardH = 1.15;
    const northBoard = new THREE.Mesh(new THREE.BoxGeometry(pitch.width + 6, boardH, 0.25), adMat);
    northBoard.position.set(0, boardH * 0.5, -(pitch.halfH + 3.2));
    northBoard.castShadow = true;
    this.stadiumGroup.add(northBoard);

    // East & West boards split around the goal mouths
    const sideSegmentLen = (pitch.height - pitch.goalWidth - 3) * 0.5;
    const sideBoardGeo = new THREE.BoxGeometry(0.25, boardH, sideSegmentLen);
    const zOffset = pitch.goalWidth * 0.5 + 1.5 + sideSegmentLen * 0.5;

    for (const sideX of [-(pitch.halfW + 3.8), pitch.halfW + 3.8]) {
      for (const sideZ of [-zOffset, zOffset]) {
        const bMesh = new THREE.Mesh(sideBoardGeo, adMat);
        bMesh.position.set(sideX, boardH * 0.5, sideZ);
        bMesh.castShadow = true;
        this.stadiumGroup.add(bMesh);
      }
    }

    // Team Benches / Dugouts along South touchline
    const dugoutMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.4,
      metalness: 0.6,
    });
    for (const benchX of [-11, 11]) {
      const dugout = new THREE.Group();
      const shell = new THREE.Mesh(new THREE.BoxGeometry(7.5, 1.9, 1.6), dugoutMat);
      shell.position.set(benchX, 0.95, pitch.halfH + 4.3);
      shell.castShadow = true;
      dugout.add(shell);

      const seatColor = benchX < 0 ? 0x0284c7 : 0xe11d48;
      const seatBar = new THREE.Mesh(
        new THREE.BoxGeometry(6.8, 0.45, 0.7),
        new THREE.MeshStandardMaterial({ color: seatColor, roughness: 0.6 })
      );
      seatBar.position.set(benchX, 0.55, pitch.halfH + 3.8);
      dugout.add(seatBar);
      this.stadiumGroup.add(dugout);
    }
  }

  private buildGrandstandsAndCrowd(pitch: PitchConfig): void {
    const concreteMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.85,
      metalness: 0.15,
    });
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.55,
      metalness: 0.5,
    });
    const trussMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.4,
      metalness: 0.75,
    });

    const tierCount = 6;
    const standLenX = pitch.width + 18;
    const standLenZ = pitch.height + 10;

    // Build North, West, and East tiered stands (South stand kept low so camera view is 100% unobstructed)
    const standsConfig = [
      { dir: 'north', x: 0, z: -(pitch.halfH + 7.5), len: standLenX, rotY: 0, tiers: tierCount, hasRoof: true },
      { dir: 'west', x: -(pitch.halfW + 8.5), z: 0, len: standLenZ, rotY: Math.PI * 0.5, tiers: tierCount, hasRoof: true },
      { dir: 'east', x: pitch.halfW + 8.5, z: 0, len: standLenZ, rotY: -Math.PI * 0.5, tiers: tierCount, hasRoof: true },
      { dir: 'south', x: 0, z: pitch.halfH + 7.5, len: standLenX, rotY: Math.PI, tiers: 2, hasRoof: false },
    ];

    const crowdPositions: { x: number; y: number; z: number; color: number }[] = [];
    const palette = [0x0284c7, 0x38bdf8, 0xe11d48, 0xf43f5e, 0xf8fafc, 0xfacc15, 0x94a3b8];

    for (const st of standsConfig) {
      const standGroup = new THREE.Group();
      standGroup.position.set(st.x, 0, st.z);
      standGroup.rotation.y = st.rotY;

      for (let t = 0; t < st.tiers; t++) {
        const stepH = 1.45;
        const stepD = 1.85;
        const tierY = (t + 0.5) * stepH;
        const tierZ = -t * stepD;

        const stepMesh = new THREE.Mesh(
          new THREE.BoxGeometry(st.len, stepH, stepD),
          concreteMat
        );
        stepMesh.position.set(0, tierY, tierZ);
        stepMesh.receiveShadow = true;
        stepMesh.castShadow = true;
        standGroup.add(stepMesh);

        // Populate lightweight spectator silhouettes along each tier
        const specSpacing = 1.85;
        const count = Math.floor((st.len - 4) / specSpacing);
        for (let s = 0; s < count; s++) {
          // Leave two narrow aisle gaps for stadium realism
          if (s % 12 === 0) continue;
          const localX = -((count - 1) * specSpacing) * 0.5 + s * specSpacing + (Math.random() - 0.5) * 0.35;
          const localY = (t + 1) * stepH + 0.42;
          const localZ = tierZ + 0.2;

          // Transform to world space for single unified InstancedMesh
          const cos = Math.cos(st.rotY);
          const sin = Math.sin(st.rotY);
          const wx = st.x + localX * cos + localZ * sin;
          const wz = st.z - localX * sin + localZ * cos;
          const color = palette[(s + t * 3) % palette.length];
          crowdPositions.push({ x: wx, y: localY, z: wz, color });
        }
      }

      if (st.hasRoof) {
        const topY = st.tiers * 1.45 + 4.2;
        const backZ = -(st.tiers - 1) * 1.85;

        // Back wall
        const backWall = new THREE.Mesh(
          new THREE.BoxGeometry(st.len, topY, 0.8),
          concreteMat
        );
        backWall.position.set(0, topY * 0.5, backZ - 1.1);
        standGroup.add(backWall);

        // Cantilever Roof Canopy
        const roofDepth = st.tiers * 1.85 + 4.5;
        const roof = new THREE.Mesh(
          new THREE.BoxGeometry(st.len + 2, 0.45, roofDepth),
          roofMat
        );
        roof.position.set(0, topY, backZ * 0.45);
        roof.rotation.x = 0.08;
        roof.castShadow = true;
        standGroup.add(roof);

        // Roof fascia trim
        const fascia = new THREE.Mesh(
          new THREE.BoxGeometry(st.len + 2, 0.55, 0.25),
          trussMat
        );
        fascia.position.set(0, topY - 0.35, backZ * 0.45 + roofDepth * 0.5);
        standGroup.add(fascia);
      }

      this.stadiumGroup.add(standGroup);
    }

    // Single InstancedMesh for all stadium spectators (1 draw call total!)
    const specGeo = new THREE.BoxGeometry(0.68, 0.88, 0.45);
    const specMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.crowdInstanced = new THREE.InstancedMesh(specGeo, specMat, crowdPositions.length);
    this.crowdInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const tmpColor = new THREE.Color();
    for (let i = 0; i < crowdPositions.length; i++) {
      const cp = crowdPositions[i];
      this.dummyObj.position.set(cp.x, cp.y, cp.z);
      this.dummyObj.rotation.set(0, 0, 0);
      const scale = 0.88 + (i % 5) * 0.06;
      this.dummyObj.scale.set(scale, scale, scale);
      this.dummyObj.updateMatrix();
      this.crowdInstanced.setMatrixAt(i, this.dummyObj.matrix);
      this.crowdBaseMatrices.push(this.dummyObj.matrix.clone());
      tmpColor.setHex(cp.color);
      this.crowdInstanced.setColorAt(i, tmpColor);
    }
    this.crowdInstanced.computeBoundingSphere();
    this.stadiumGroup.add(this.crowdInstanced);
  }

  private buildFloodlightTowers(pitch: PitchConfig): void {
    const pylonMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.45,
      metalness: 0.75,
    });
    const lampMat = new THREE.MeshBasicMaterial({
      color: 0xfef9c3,
    });

    const corners = [
      { x: -(pitch.halfW + 13), z: -(pitch.halfH + 11) },
      { x: pitch.halfW + 13, z: -(pitch.halfH + 11) },
      { x: -(pitch.halfW + 13), z: pitch.halfH + 11 },
      { x: pitch.halfW + 13, z: pitch.halfH + 11 },
    ];

    for (const c of corners) {
      const tower = new THREE.Group();
      tower.position.set(c.x, 0, c.z);

      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.85, 26, 8), pylonMat);
      mast.position.y = 13;
      tower.add(mast);

      const headFrame = new THREE.Mesh(new THREE.BoxGeometry(5.2, 2.8, 0.8), pylonMat);
      headFrame.position.y = 26.5;
      headFrame.lookAt(0, 0, 0);
      tower.add(headFrame);

      const lampPanel = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.2), lampMat);
      lampPanel.position.y = 26.4;
      lampPanel.lookAt(0, 0, 0);
      lampPanel.translateZ(0.45);
      tower.add(lampPanel);

      this.stadiumGroup.add(tower);
    }
  }

  public update(elapsedTime: number, phase: MatchPhase, _scoringTeam?: TeamId): void {
    if (!this.crowdInstanced) return;

    // Animate crowd jump during GOAL_CELEBRATION or gentle wave during match
    const isGoal = phase === 'GOAL_CELEBRATION';
    if (!isGoal && Math.floor(elapsedTime * 30) % 2 !== 0) return;

    const count = this.crowdBaseMatrices.length;
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    for (let i = 0; i < count; i++) {
      const baseMat = this.crowdBaseMatrices[i];
      baseMat.decompose(pos, quat, scale);
      if (isGoal) {
        pos.y += Math.abs(Math.sin(elapsedTime * 12 + i * 0.7)) * 0.55;
      } else {
        pos.y += Math.sin(elapsedTime * 3.2 + i * 0.5) * 0.08;
      }
      this.dummyObj.position.copy(pos);
      this.dummyObj.quaternion.copy(quat);
      this.dummyObj.scale.copy(scale);
      this.dummyObj.updateMatrix();
      this.crowdInstanced.setMatrixAt(i, this.dummyObj.matrix);
    }
    this.crowdInstanced.instanceMatrix.needsUpdate = true;
  }

  public dispose(): void {
    this.pitchTexture?.dispose();
    this.netTexture?.dispose();
    this.adTexture?.dispose();
    this.stadiumGroup.traverse((obj) => {
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
