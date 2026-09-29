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
  // spawnMissile
  // Projétil de magia: uma bolinha que voa do sqm de origem até o de destino.

  spawnMissile(fromX, fromY, toX, toY, renderer) {
    this.missiles = this.missiles || [];
    this.missiles.push({ fromX, fromY, toX, toY, renderer, createdAt: performance.now(), duration: 280 });
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
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.font = `bold ${this.fontSize}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const text = p.isXP ? `+${p.value} XP` : `-${p.value}`;
      ctx.fillStyle = p.isXP ? "#00FF00" : "#FF0000";
      ctx.fillText(text, p.x, p.y);

      ctx.restore();
    }
  }

  // ================================================================================================================================================================================================================================================
  // clear

  clear() {
    this.particles = [];
    this.missiles = [];
  }
}