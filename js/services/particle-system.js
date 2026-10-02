// js/services/particle-system.js

export class ParticleSystem {
  constructor() {
    this.particles = [];
    this.fontSize = 16;
  }

  // ================================================================================================================================================================================================================================================
  // spawnDamageNumber

  spawnDamageNumber(x, y, value, isXP, renderer) {
    const pos = renderer.gridToScreenWithOffset(x, y);
    this.particles.push({
      x: pos.x,
      y: pos.y - 30,
      value: value,
      isXP: isXP,
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
  // Projétil de magia: uma bolinha que voa do sqm de origem até o de destino.

  spawnMissile(fromX, fromY, toX, toY, renderer) {
    this.missiles = this.missiles || [];
    this.missiles.push({ fromX, fromY, toX, toY, renderer, createdAt: performance.now(), duration: 280 });
  }

  // ================================================================================================================================================================================================================================================
  // spawnPuff
  // Golpe bloqueado: uma fumacinha cinza que se abre e some no sqm.

  spawnPuff(x, y, renderer) {
    this.puffs = this.puffs || [];
    this.puffs.push({ x, y, renderer, createdAt: performance.now(), duration: 450 });
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
    this.puffs = (this.puffs || []).filter(p => timestamp - p.createdAt < p.duration);
  }

  // ================================================================================================================================================================================================================================================
  // render

  render(ctx) {
    for (const m of this.missiles || []) {
      const t = Math.max(0, Math.min(1, (performance.now() - m.createdAt) / m.duration));
      const size = m.renderer.camera.tileSize;
      const from = m.renderer.gridToScreenWithOffset(m.fromX, m.fromY);
      const to = m.renderer.gridToScreenWithOffset(m.toX, m.toY);
      const x = from.x + (to.x - from.x) * t + size / 2;
      const y = from.y + (to.y - from.y) * t + size / 2;
      ctx.save();
      ctx.fillStyle = '#c084fc';
      ctx.shadowColor = '#a855f7';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    for (const puff of this.puffs || []) {
      const t = Math.max(0, Math.min(1, (performance.now() - puff.createdAt) / puff.duration));
      const size = puff.renderer.camera.tileSize;
      const at = puff.renderer.gridToScreenWithOffset(puff.x, puff.y);
      ctx.save();
      ctx.globalAlpha = 0.8 * (1 - t);
      ctx.fillStyle = '#d4d4d8';
      for (let i = 0; i < 5; i++) {
        const angle = i / 5 * Math.PI * 2;
        const spread = size * (0.08 + 0.22 * t);
        ctx.beginPath();
        ctx.arc(at.x + size / 2 + Math.cos(angle) * spread, at.y + size / 2 + Math.sin(angle) * spread, size * (0.1 + 0.06 * t), 0, Math.PI * 2);
        ctx.fill();
      }
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
    this.puffs = [];
  }
}