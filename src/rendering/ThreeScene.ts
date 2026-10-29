import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GameEngine } from '../game/GameEngine';
import { AWAY_KIT, HOME_KIT } from '../game/Team';
import { CameraMode, MatchPhase, PitchConfig } from '../types/game';
import { Ball3DMesh } from './Ball3DMesh';
import { ConfettiFX } from './ConfettiFX';
import { Player3DMesh } from './Player3DMesh';
import { StadiumRenderer } from './StadiumRenderer';
import { VolumetricLighting } from './VolumetricLighting';

export interface ScreenProjection {
  x: number;
  y: number;
  scale: number;
}

export class ThreeScene {
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;
  public readonly renderer: THREE.WebGLRenderer | null = null;
  public readonly isSoftwareGl: boolean;
  public readonly stadium: StadiumRenderer | null = null;

  public readonly playerMeshes = new Map<string, Player3DMesh>();
  public readonly ball3D: Ball3DMesh;
  public readonly confetti: ConfettiFX;
  public readonly volumetric: VolumetricLighting;

  private width = 1280;
  private height = 720;
  private camCurrentX = 0;
  private camCurrentY = 38;
  private camCurrentZ = 48;
  private camLookX = 0;
  private camLookY = 0;
  private camLookZ = 1.5;
  private elapsedTime = 0;
  private lastPhase: MatchPhase = 'MENU';

  // Reusable projection vector (zero GC in loop)
  private readonly projVec = new THREE.Vector3();

  constructor(container: HTMLElement, pitch: PitchConfig) {
    this.width = container.clientWidth || window.innerWidth;
    this.height = container.clientHeight || window.innerHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070b12);
    this.scene.fog = new THREE.FogExp2(0x070b12, 0.0052);

    this.camera = new THREE.PerspectiveCamera(38, this.width / this.height, 1, 320);
    this.camera.position.set(0, 40, 48);
    this.camera.lookAt(0, 0, 1.5);

    this.isSoftwareGl = ThreeScene.detectSoftwareWebGL();

    // 1. Initialize 3D Ball
    this.ball3D = new Ball3DMesh(pitch.goalHeight * 0.18);
    this.scene.add(this.ball3D.group);

    // 2. Initialize 3D Confetti Cannon
    this.confetti = new ConfettiFX(pitch);
    this.scene.add(this.confetti.group);

    // 3. Initialize Volumetric Floodlight Beams
    this.volumetric = new VolumetricLighting(pitch);
    this.scene.add(this.volumetric.group);

    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: !this.isSoftwareGl,
        powerPreference: 'high-performance',
      });
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.08;
      this.renderer.setPixelRatio(
        this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
      );
      this.renderer.setSize(this.width, this.height);
      this.renderer.shadowMap.enabled = !this.isSoftwareGl;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      container.innerHTML = '';
      container.appendChild(this.renderer.domElement);

      // Studio PBR Environment reflection
      const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
      pmremGenerator.dispose();

      // Balanced Floodlight Lighting Rig
      const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x0f172a, 0.85);
      this.scene.add(hemiLight);

      const mainFloodLight = new THREE.DirectionalLight(0xfffbeb, 1.85);
      mainFloodLight.position.set(24, 52, 34);
      if (!this.isSoftwareGl) {
        mainFloodLight.castShadow = true;
        mainFloodLight.shadow.mapSize.width = 1024;
        mainFloodLight.shadow.mapSize.height = 1024;
        mainFloodLight.shadow.camera.near = 10;
        mainFloodLight.shadow.camera.far = 140;
        const d = 48;
        mainFloodLight.shadow.camera.left = -d;
        mainFloodLight.shadow.camera.right = d;
        mainFloodLight.shadow.camera.top = d;
        mainFloodLight.shadow.camera.bottom = -d;
        mainFloodLight.shadow.bias = -0.0005;
      }
      this.scene.add(mainFloodLight);

      const rimFloodLight = new THREE.DirectionalLight(0x93c5fd, 0.75);
      rimFloodLight.position.set(-28, 42, -32);
      this.scene.add(rimFloodLight);

      const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
      this.stadium = new StadiumRenderer(pitch, maxAniso);
      this.scene.add(this.stadium.stadiumGroup);

      if (!this.isSoftwareGl) {
        this.renderer.compile(this.scene, this.camera);
      }
    } catch {
      this.renderer = null;
    }
  }

  private static detectSoftwareWebGL(): boolean {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    } catch {
      return true;
    }
  }

  /**
   * Synchronize 3D player meshes with the current game engine state.
   */
  public syncPlayers(engine: GameEngine): void {
    const players = engine.allPlayers;
    for (const player of players) {
      if (!this.playerMeshes.has(player.state.id)) {
        const kit = player.state.team === 'home' ? HOME_KIT : AWAY_KIT;
        const mesh = new Player3DMesh(player.state, kit);
        this.playerMeshes.set(player.state.id, mesh);
        this.scene.add(mesh.root);
      }
    }
  }

  public resize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.camera.aspect = this.width / this.height;

    // Automatically adjust FOV on portrait or narrow screens
    const aspect = this.width / this.height;
    this.camera.fov = aspect < 1.2 ? Math.min(54, 44 / Math.max(0.65, aspect * 0.85)) : 37;
    this.camera.updateProjectionMatrix();

    if (this.renderer) {
      this.renderer.setSize(this.width, this.height);
    }
  }

  /**
   * Updates 3D camera tracking, 3D players, 3D ball, and confetti FX.
   */
  public updateAndRender(dt: number, engine: GameEngine): void {
    this.elapsedTime += dt;
    this.syncPlayers(engine);

    const phase = engine.phase;
    const ball = engine.ball.state;
    const controlled = engine.getControlledPlayer();
    const cameraMode: CameraMode = engine.settings.cameraMode || 'broadcast';

    // 1. Goal Celebration trigger
    if (phase === 'GOAL_CELEBRATION' && this.lastPhase !== 'GOAL_CELEBRATION') {
      const goalX = ball.x > 0 ? engine.pitch.halfW : -engine.pitch.halfW;
      const scoringTeam = ball.x > 0 ? 'home' : 'away';
      this.confetti.triggerGoal(scoringTeam, goalX);
    } else if (phase !== 'GOAL_CELEBRATION' && this.lastPhase === 'GOAL_CELEBRATION') {
      this.confetti.reset();
    }
    this.lastPhase = phase;

    // 2. Multi-Perspective Cinematic Camera Tracking ("4D Views")
    if (phase === 'MENU') {
      // Gentle cinematic broadcast sweep in menu
      const targetX = Math.sin(this.elapsedTime * 0.25) * 9;
      this.camCurrentX = THREE.MathUtils.damp(this.camCurrentX, targetX, 2.5, dt);
      this.camCurrentY = THREE.MathUtils.damp(this.camCurrentY, 36, 2.5, dt);
      this.camCurrentZ = THREE.MathUtils.damp(this.camCurrentZ, 46, 2.5, dt);
      this.camLookX = THREE.MathUtils.damp(this.camLookX, targetX * 0.65, 2.5, dt);
      this.camLookY = THREE.MathUtils.damp(this.camLookY, 0, 2.5, dt);
      this.camLookZ = THREE.MathUtils.damp(this.camLookZ, 0, 2.5, dt);
    } else if (phase === 'GOAL_CELEBRATION') {
      // Cinematic slow-motion orbit around the goalscorer celebrating!
      const orbitAngle = this.elapsedTime * 0.8;
      const targetCamX = ball.x + Math.cos(orbitAngle) * 14;
      const targetCamY = 9 + Math.sin(this.elapsedTime * 0.5) * 2;
      const targetCamZ = ball.y + Math.sin(orbitAngle) * 14;

      this.camCurrentX = THREE.MathUtils.damp(this.camCurrentX, targetCamX, 4.0, dt);
      this.camCurrentY = THREE.MathUtils.damp(this.camCurrentY, targetCamY, 4.0, dt);
      this.camCurrentZ = THREE.MathUtils.damp(this.camCurrentZ, targetCamZ, 4.0, dt);
      this.camLookX = THREE.MathUtils.damp(this.camLookX, ball.x, 5.0, dt);
      this.camLookY = THREE.MathUtils.damp(this.camLookY, 1.8, 5.0, dt);
      this.camLookZ = THREE.MathUtils.damp(this.camLookZ, ball.y, 5.0, dt);
    } else if (cameraMode === 'action') {
      // Action Cam (3rd person dynamic follow cam behind user player!)
      const px = controlled.state.x;
      const py = controlled.state.y;
      const facingAngle = controlled.state.angle;

      // Position camera behind player facing direction with height
      const camDist = 16.5;
      const targetCamX = px - Math.cos(facingAngle) * camDist;
      const targetCamY = 12.5;
      const targetCamZ = py - Math.sin(facingAngle) * camDist * 0.7 + 6;

      const targetLookX = px + Math.cos(facingAngle) * 8 + ball.x * 0.2;
      const targetLookY = 1.6;
      const targetLookZ = py + Math.sin(facingAngle) * 6 + ball.y * 0.2;

      this.camCurrentX = THREE.MathUtils.damp(this.camCurrentX, targetCamX, 4.5, dt);
      this.camCurrentY = THREE.MathUtils.damp(this.camCurrentY, targetCamY, 4.5, dt);
      this.camCurrentZ = THREE.MathUtils.damp(this.camCurrentZ, targetCamZ, 4.5, dt);
      this.camLookX = THREE.MathUtils.damp(this.camLookX, targetLookX, 5.5, dt);
      this.camLookY = THREE.MathUtils.damp(this.camLookY, targetLookY, 5.5, dt);
      this.camLookZ = THREE.MathUtils.damp(this.camLookZ, targetLookZ, 5.5, dt);
    } else if (cameraMode === 'endline') {
      // Behind-the-goal perspective looking downfield
      const targetCamX = -engine.pitch.halfW - 14;
      const targetCamY = 18;
      const targetCamZ = ball.y * 0.35;

      const targetLookX = ball.x * 0.65;
      const targetLookY = 1.5;
      const targetLookZ = ball.y * 0.55;

      this.camCurrentX = THREE.MathUtils.damp(this.camCurrentX, targetCamX, 5.0, dt);
      this.camCurrentY = THREE.MathUtils.damp(this.camCurrentY, targetCamY, 5.0, dt);
      this.camCurrentZ = THREE.MathUtils.damp(this.camCurrentZ, targetCamZ, 5.0, dt);
      this.camLookX = THREE.MathUtils.damp(this.camLookX, targetLookX, 6.0, dt);
      this.camLookY = THREE.MathUtils.damp(this.camLookY, targetLookY, 6.0, dt);
      this.camLookZ = THREE.MathUtils.damp(this.camLookZ, targetLookZ, 6.0, dt);
    } else if (cameraMode === 'tactical') {
      // 4D Panoramic Tactical High-Angle View
      const targetCamX = 0;
      const targetCamY = 56;
      const targetCamZ = 58;

      const targetLookX = ball.x * 0.32;
      const targetLookY = 0;
      const targetLookZ = ball.y * 0.22;

      this.camCurrentX = THREE.MathUtils.damp(this.camCurrentX, targetCamX, 4.0, dt);
      this.camCurrentY = THREE.MathUtils.damp(this.camCurrentY, targetCamY, 4.0, dt);
      this.camCurrentZ = THREE.MathUtils.damp(this.camCurrentZ, targetCamZ, 4.0, dt);
      this.camLookX = THREE.MathUtils.damp(this.camLookX, targetLookX, 5.0, dt);
      this.camLookY = THREE.MathUtils.damp(this.camLookY, targetLookY, 5.0, dt);
      this.camLookZ = THREE.MathUtils.damp(this.camLookZ, targetLookZ, 5.0, dt);
    } else {
      // Default Broadcast TV Camera
      const isWide = engine.settings.cameraZoom === 'wide';
      const baseHeight = isWide ? 44 : 37.5;
      const baseZ = isWide ? 51 : 45.5;

      const targetCamX = THREE.MathUtils.clamp(ball.x * 0.46, -15, 15);
      const targetCamZ = baseZ + THREE.MathUtils.clamp(ball.y * 0.22, -4, 5);
      const targetLookX = THREE.MathUtils.clamp(ball.x * 0.58, -19, 19);
      const targetLookZ = THREE.MathUtils.clamp(ball.y * 0.35 + 1.2, -6, 8);

      this.camCurrentX = THREE.MathUtils.damp(this.camCurrentX, targetCamX, 5.5, dt);
      this.camCurrentY = THREE.MathUtils.damp(this.camCurrentY, baseHeight, 5.5, dt);
      this.camCurrentZ = THREE.MathUtils.damp(this.camCurrentZ, targetCamZ, 5.5, dt);
      this.camLookX = THREE.MathUtils.damp(this.camLookX, targetLookX, 6.5, dt);
      this.camLookY = THREE.MathUtils.damp(this.camLookY, 0, 6.5, dt);
      this.camLookZ = THREE.MathUtils.damp(this.camLookZ, targetLookZ, 6.5, dt);
    }

    this.camera.position.set(this.camCurrentX, this.camCurrentY, this.camCurrentZ);
    this.camera.lookAt(this.camLookX, this.camLookY, this.camLookZ);
    this.camera.updateMatrixWorld();

    // 3. Update 3D Players
    for (const player of engine.allPlayers) {
      const mesh = this.playerMeshes.get(player.state.id);
      if (mesh) {
        mesh.update(
          player.state,
          player.state.id === engine.controlledPlayerId,
          dt,
          phase,
          this.elapsedTime
        );
      }
    }

    // 4. Update 3D Ball
    this.ball3D.update(engine.ball.state, dt);

    // 5. Update Confetti & Stadium
    this.confetti.update(dt);

    if (this.stadium) {
      this.stadium.update(this.elapsedTime, phase);
    }

    // 6. Render WebGL Frame
    if (this.renderer) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  /**
   * Projects a 3D world coordinate into exact 2D canvas pixel coordinates and perspective scale.
   */
  public worldToScreen(
    pitchX: number,
    pitchY: number,
    heightZ: number,
    out: ScreenProjection
  ): void {
    this.projVec.set(pitchX, heightZ, pitchY);
    this.projVec.project(this.camera);

    out.x = (this.projVec.x * 0.5 + 0.5) * this.width;
    out.y = (-this.projVec.y * 0.5 + 0.5) * this.height;

    const dx = pitchX - this.camera.position.x;
    const dy = heightZ - this.camera.position.y;
    const dz = pitchY - this.camera.position.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const fovScale = 37 / this.camera.fov;
    out.scale = (this.height / Math.max(20, dist)) * 0.78 * fovScale;
  }

  public getGlContext(): WebGL2RenderingContext | WebGLRenderingContext | null {
    return this.renderer ? this.renderer.getContext() : null;
  }

  public dispose(): void {
    this.stadium?.dispose();
    this.ball3D.dispose();
    this.confetti.dispose();
    this.volumetric.dispose();
    for (const mesh of this.playerMeshes.values()) {
      mesh.dispose();
    }
    this.playerMeshes.clear();
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}
