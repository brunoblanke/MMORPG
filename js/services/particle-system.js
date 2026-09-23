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
  }

  // ================================================================================================================================================================================================================================================
  // render

  render(ctx) {
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
  }
}