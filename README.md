# PitchSide 5v5 — Arcade Stadium Football

A responsive 2D arcade football game set inside an immersive 3D stadium with 5v5 gameplay, tactical AI, full keyboard and touch controls.

## Features
- **3D Stadium Environment**: Rendered with Three.js (dynamic floodlights, grandstands, turf, goal nets).
- **2D Arcade Match Physics**: Crisp 2D player rendering, ball mechanics, curve shots, passing, and tackling.
- **5v5 Tactical AI**: Teammate supporting runs, intelligent keeper behavior, and dynamic opponent tactics.
- **Controls**: Responsive keyboard controls (WASD/Arrows, Space for Shoot, J/K for Pass/Tackle) and mobile on-screen joystick + buttons.
- **Customizable**: Team kit selection, difficulty levels (Casual, Standard, Pro), and match duration.

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Development Server
```bash
npm run dev
```
Open your browser and navigate to `http://localhost:3000`.

### 3. Production Build
```bash
npm run build
npm run preview
```

## Controls
- **Move**: `W`, `A`, `S`, `D` or Arrow Keys
- **Pass / Slide Tackle**: `K` or `X`
- **Shoot / Clear**: `Space` or `J` (Hold to charge power)
- **Sprint**: `Shift`
- **Switch Player**: `E` or `C`
- **Pause**: `Escape` or `P`
