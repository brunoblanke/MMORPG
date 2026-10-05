// js/services/particle-system.js

import { EFFECTS, MISSILES, effectUrl, missileUrl, missileDirection } from '../../shared/effects.js';

// As imagens dos efeitos e projéteis do Tibia, carregadas na primeira vez
// que aparecem.
const images = new Map();

// ================================================================================================================================================================================================================================================
// loadImage

function loadImage(url) {
  if (!images.has(url)) {
    const img = new Image();
    img.src = url;
    images.set(url, img);
  }
  return images.get(url);
}

export class ParticleSystem {
  constructor() {
    this.particles = [];
    this.fontSize = 16;
  }

  // ================================================================================================================================================================================================================================================
  // spawnDamageNumber

  spawnDamageNumber(x, y, value, isXP, renderer, color = null) {
    const pos = renderer.gridToScreenWithOffset(x, y);
    this.particles.push({
      x: pos.x,
      y: pos.y - 30,
      value: value,
      isXP: isXP,
      color,
      maxLife: 1.5,
      velocityY: -1.2,
      opacity: 1.0,
      createdAt: performance.now()
    });
  }

  // ================================================================================================================================================================================================================================================
  // spawnText
  // Número flutuante com texto e cor próprios (vida/mana recuperadas).

  spawnText(x, y, text, color, renderer, offsetY = 0) {
    const pos = renderer.gridToScreenWithOffset(x, y);
    this.particles.push({
      x: pos.x,
      y: pos.y - 30 + offsetY,
      text,
      color,
      maxLife: 1.5,
      velocityY: -1.2,
      opacity: 1.0,
      createdAt: performance.now()
    });
  }

  // ================================================================================================================================================================================================================================================
  // spawnMissile
  // Projétil do Tibia (shared/effects.js) que voa do sqm de origem até o de
  // destino, virado pra direção dele.

  spawnMissile(fromX, fromY, toX, toY, renderer, kind = 'energy') {
    const name = MISSILES[kind] ? kind : 'energy';
    this.missiles = this.missiles || [];
    this.missiles.push({ fromX, fromY, toX, toY, renderer, img: loadImage(missileUrl(name)), size: MISSILES[name].size, dir: missileDirection(toX - fromX, toY - fromY), createdAt: performance.now(), duration: 280 });
  }

  // ================================================================================================================================================================================================================================================
  // spawnEffect
  // Efeito do Tibia (shared/effects.js) animado em cada sqm de tiles.

  spawnEffect(tiles, name, renderer) {
    const info = EFFECTS[name];
    if (!info) return;
    this.effects = this.effects || [];
    this.effects.push({ tiles, img: loadImage(effectUrl(name)), frames: info.frames, size: info.size, ms: info.ms, renderer, createdAt: performance.now(), duration: info.frames * info.ms });
  }

  // ================================================================================================================================================================================================================================================
  // update

  update(timestamp) {
    this.particles = this.particles.filter(p => {
      const age = (timestamp - p.createdAt) / 1000;
      const progress = age / p.maxLife;
      
      if (progress >= 1) return false;
      
      p.y += p.velocityY;
      p.opacity = 1 - progress;
      
      return true;
    });
    this.missiles = (this.missiles || []).filter(m => timestamp - m.createdAt < m.duration);
    this.effects = (this.effects || []).filter(e => timestamp - e.createdAt < e.duration);
  }

  // ================================================================================================================================================================================================================================================
  // render

  render(ctx) {
    for (const e of this.effects || []) {
      if (!e.img.complete || !e.img.naturalWidth) continue;
      const frame = Math.min(e.frames - 1, Math.floor((performance.now() - e.createdAt) / e.ms));
      const tile = e.renderer.camera.tileSize;
      const size = e.size / 32 * tile;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      for (const [x, y] of e.tiles) {
        const pos = e.renderer.gridToScreenWithOffset(x, y);
        ctx.drawImage(e.img, frame * e.size, 0, e.size, e.size, pos.x + tile - size, pos.y + tile - size, size, size);
      }
      ctx.restore();
    }
    for (const m of this.missiles || []) {
      if (!m.img.complete || !m.img.naturalWidth) continue;
      const t = Math.max(0, Math.min(1, (performance.now() - m.createdAt) / m.duration));
      const tile = m.renderer.camera.tileSize;
      const size = m.size / 32 * tile;
      const from = m.renderer.gridToScreenWithOffset(m.fromX, m.fromY);
      const to = m.renderer.gridToScreenWithOffset(m.toX, m.toY);
      const x = from.x + (to.x - from.x) * t;
      const y = from.y + (to.y - from.y) * t;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(m.img, m.dir[0] * m.size, m.dir[1] * m.size, m.size, m.size, x + tile - size, y + tile - size, size, size);
      ctx.restore();
    }
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.font = `bold ${this.fontSize}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const text = p.text || (p.isXP ? `+${p.value} XP` : `-${p.value}`);
      ctx.fillStyle = p.color || (p.isXP ? "#00FF00" : "#FF0000");
      ctx.fillText(text, p.x, p.y);

      ctx.restore();
    }
  }

  // ================================================================================================================================================================================================================================================
  // clear

  clear() {
    this.particles = [];
    this.missiles = [];
    this.effects = [];
  }
}