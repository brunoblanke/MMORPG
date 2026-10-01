// js/views/speech.js

import { CONFIG } from '../config.js';
import { drawTibiaText, TIBIA_FONT } from './tibia-text.js';

// Falas na tela, como no Tibia antigo: "Nome diz:" e o texto em cima do sqm
// onde a fala foi dita. Ficam paradas ali (não seguem quem falou), na cor de
// quem fala (player amarelo, NPC azul) e, no fim, sobem esmaecendo.

const SPEECH_COLORS = { player: '#ffd84a', npc: '#7fd4ff' };
const BASE_MS = 3000;
const PER_CHAR_MS = 50;
const MAX_MS = 9000;
const FADE_MS = 700;
const FADE_RISE = 14;
const LINE_HEIGHT = 13;
const MAX_WIDTH = 220;
const GAP = 4;

export class SpeechLayer {

  // ================================================================================================================================================================================================================================================
  // constructor

  constructor() {
    this.items = [];
  }

  // ================================================================================================================================================================================================================================================
  // add
  // Evento speech do servidor, a partir de agora (now: relógio da tela).

  add(event, now) {
    const duration = Math.min(MAX_MS, BASE_MS + event.text.length * PER_CHAR_MS);
    this.items.push({ ...event, createdAt: now, expiresAt: now + duration });
  }

  // ================================================================================================================================================================================================================================================
  // wrap
  // Quebra o texto em linhas de até MAX_WIDTH px.

  wrap(ctx, text) {
    ctx.save();
    ctx.font = TIBIA_FONT;
    const lines = [];
    let line = '';
    for (const word of text.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > MAX_WIDTH) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    ctx.restore();
    return lines;
  }

  // ================================================================================================================================================================================================================================================
  // draw
  // As falas do andar level ainda na tela. No mesmo sqm, a mais nova fica
  // embaixo e as mais velhas sobem.

  draw(ctx, renderer, level, now) {
    this.items = this.items.filter(item => item.expiresAt > now);
    const byTile = new Map();
    for (const item of this.items) {
      if (item.z !== level) continue;
      const key = `${item.x},${item.y}`;
      if (!byTile.has(key)) byTile.set(key, []);
      byTile.get(key).push(item);
    }
    const size = CONFIG.tileSize;
    for (const group of byTile.values()) {
      const base = renderer.gridToScreenWithOffset(group[0].x, group[0].y);
      let bottom = base.y - 33;
      for (const item of [...group].reverse()) {
        const lines = [`${item.name} diz:`, ...this.wrap(ctx, item.text)];
        const fade = Math.max(0, Math.min(1, 1 - (item.expiresAt - now) / FADE_MS));
        const rise = fade * FADE_RISE;
        ctx.save();
        ctx.globalAlpha = 1 - fade;
        lines.forEach((line, i) => drawTibiaText(ctx, line, base.x + size / 2, bottom - rise - (lines.length - 1 - i) * LINE_HEIGHT, SPEECH_COLORS[item.npc ? 'npc' : 'player']));
        ctx.restore();
        bottom -= lines.length * LINE_HEIGHT + GAP;
      }
    }
  }
}
