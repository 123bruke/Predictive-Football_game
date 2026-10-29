import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MatchPhase, PitchConfig } from '../types/game';
import { StadiumRenderer } from './StadiumRenderer';

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

  private width = 1280;
  private height = 720;
  private camCurrentX = 0;
  private camCurrentZ = 48;
  private camLookX = 0;
  private camLookZ = 1.5;
  private elapsedTime = 0;

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

  public resize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.camera.aspect = this.width / this.height;

    // Automatically adjust FOV on portrait or narrow screens so the pitch remains well-framed
    const aspect = this.width / this.height;
    this.camera.fov = aspect < 1.2 ? Math.min(54, 44 / Math.max(0.65, aspect * 0.85)) : 37;
    this.camera.updateProjectionMatrix();

    if (this.renderer) {
      this.renderer.setSize(this.width, this.height);
    }
  }

  /**
   * Updates camera tracking smoothly using exponential damping and renders the 3D stadium.
   */
  public updateAndRender(
    dt: number,
    ballX: number,
    ballY: number,
    phase: MatchPhase,
    cameraZoom: 'broadcast' | 'wide'
  ): void {
    this.elapsedTime += dt;

    if (phase === 'MENU') {
      // Gentle cinematic broadcast sweep in menu
      const targetX = Math.sin(this.elapsedTime * 0.25) * 9;
      this.camCurrentX = THREE.MathUtils.damp(this.camCurrentX, targetX, 2.5, dt);
      this.camLookX = THREE.MathUtils.damp(this.camLookX, targetX * 0.65, 2.5, dt);
      this.camera.position.set(this.camCurrentX, 38, 47);
      this.camera.lookAt(this.camLookX, 0, 0);
    } else {
      const isWide = cameraZoom === 'wide';
      const baseHeight = isWide ? 45 : 37.5;
      const baseZ = isWide ? 52 : 45.5;

      // Track ball position smoothly while keeping full tactical vision
      const targetCamX = THREE.MathUtils.clamp(ballX * 0.46, -15, 15);
      const targetCamZ = baseZ + THREE.MathUtils.clamp(ballY * 0.22, -4, 5);
      const targetLookX = THREE.MathUtils.clamp(ballX * 0.58, -19, 19);
      const targetLookZ = THREE.MathUtils.clamp(ballY * 0.35 + 1.2, -6, 8);

      this.camCurrentX = THREE.MathUtils.damp(this.camCurrentX, targetCamX, 5.5, dt);
      this.camCurrentZ = THREE.MathUtils.damp(this.camCurrentZ, targetCamZ, 5.5, dt);
      this.camLookX = THREE.MathUtils.damp(this.camLookX, targetLookX, 6.5, dt);
      this.camLookZ = THREE.MathUtils.damp(this.camLookZ, targetLookZ, 6.5, dt);

      this.camera.position.set(this.camCurrentX, baseHeight, this.camCurrentZ);
      this.camera.lookAt(this.camLookX, 0, this.camLookZ);
    }

    this.camera.updateMatrixWorld();

    if (this.stadium) {
      this.stadium.update(this.elapsedTime, phase);
    }

    if (this.renderer) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  /**
   * Projects a 2D pitch coordinate (pitchX, pitchY) and optional vertical elevation (heightZ)
   * into exact 2D canvas pixel coordinates and perspective scale.
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

    // Perspective scale proportional to camera distance so players nearer the bottom are slightly larger
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
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}
