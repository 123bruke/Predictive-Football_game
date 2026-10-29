import { PitchConfig, TeamId, TeamKit } from '../types/game';
import { Player } from './Player';

export const HOME_KIT: TeamKit = {
  id: 'home',
  name: 'Albion Athletic',
  shortName: 'ALB',
  primaryColor: '#0284c7', // Vibrant Sky Royal Blue
  secondaryColor: '#f8fafc',
  shortsColor: '#0f172a',
  socksColor: '#0284c7',
  gkColor: '#f59e0b',
  accentColor: '#38bdf8',
};

export const AWAY_KIT: TeamKit = {
  id: 'away',
  name: 'Real Valiente',
  shortName: 'VAL',
  primaryColor: '#e11d48', // Crimson Rose Red
  secondaryColor: '#fef08a',
  shortsColor: '#ffffff',
  socksColor: '#be123c',
  gkColor: '#10b981',
  accentColor: '#fb7185',
};

export class Team {
  public readonly id: TeamId;
  public readonly kit: TeamKit;
  public readonly players: Player[];

  constructor(id: TeamId, pitch: PitchConfig) {
    this.id = id;
    this.kit = id === 'home' ? HOME_KIT : AWAY_KIT;
    const dir = id === 'home' ? 1 : -1; // Home attacks +X (right), Away attacks -X (left)

    const roster =
      id === 'home'
        ? [
            { num: 1, name: 'Raya', role: 'GK' as const, ax: -0.92, ay: 0, kx: -pitch.halfW + 3.2, ky: 0, skin: '#f1c27d', hair: '#27272a' },
            { num: 4, name: 'Saliba', role: 'DEF' as const, ax: -0.52, ay: -0.45, kx: -pitch.halfW * 0.48, ky: -pitch.halfH * 0.42, skin: '#8d5524', hair: '#18181b' },
            { num: 6, name: 'Gabriel', role: 'DEF' as const, ax: -0.52, ay: 0.45, kx: -pitch.halfW * 0.48, ky: pitch.halfH * 0.42, skin: '#c68642', hair: '#18181b' },
            { num: 8, name: 'Odegaard', role: 'MID' as const, ax: -0.12, ay: 0.28, kx: -pitch.halfW * 0.2, ky: pitch.halfH * 0.25, skin: '#ffdbac', hair: '#d97706' },
            { num: 9, name: 'Saka', role: 'FWD' as const, ax: 0.34, ay: -0.18, kx: -pitch.halfW * 0.14, ky: -pitch.halfH * 0.16, skin: '#8d5524', hair: '#18181b' },
          ]
        : [
            { num: 1, name: 'Costa', role: 'GK' as const, ax: 0.92, ay: 0, kx: pitch.halfW - 3.2, ky: 0, skin: '#e0ac69', hair: '#27272a' },
            { num: 3, name: 'Dias', role: 'DEF' as const, ax: 0.52, ay: -0.45, kx: pitch.halfW * 0.48, ky: -pitch.halfH * 0.42, skin: '#f1c27d', hair: '#3f3f46' },
            { num: 5, name: 'Silva', role: 'DEF' as const, ax: 0.52, ay: 0.45, kx: pitch.halfW * 0.48, ky: pitch.halfH * 0.42, skin: '#c68642', hair: '#18181b' },
            { num: 10, name: 'Vitinha', role: 'MID' as const, ax: 0.12, ay: -0.28, kx: pitch.halfW * 0.2, ky: -pitch.halfH * 0.25, skin: '#f1c27d', hair: '#451a03' },
            { num: 11, name: 'Leao', role: 'FWD' as const, ax: -0.34, ay: 0.18, kx: pitch.halfW * 0.14, ky: pitch.halfH * 0.16, skin: '#8d5524', hair: '#18181b' },
          ];

    this.players = roster.map(
      (r, idx) =>
        new Player({
          id: `${id}_${idx}`,
          team: id,
          number: r.num,
          name: r.name,
          role: r.role,
          anchorX: r.ax * pitch.halfW,
          anchorY: r.ay * pitch.halfH,
          kickoffX: r.kx,
          kickoffY: r.ky * dir,
          skinTone: r.skin,
          hairColor: r.hair,
        })
    );
  }

  public resetForKickoff(hasKickoffPossession: boolean): void {
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      p.resetToKickoff(hasKickoffPossession, p.state.role === 'FWD');
    }
  }
}
