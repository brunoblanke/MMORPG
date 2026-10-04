// js/services/particle-system.js

// Projéteis: flecha e lança (risco e ponta) e as bolinhas de magia ([cor,
// brilho]) de cada tipo.
const MISSILE_SHAFTS = {
  arrow: { length: 12, color: '#c8a46a', tip: '#d8d8d8' },
  spear: { length: 18, color: '#9a7446', tip: '#e0e0e0' }
};
const MISSILE_COLORS = {
  energy: ['#c084fc', '#a855f7'],
  fire: ['#ffb347', '#ff5a1f'],
  poison: ['#8ef070', '#2fbf3a'],
  ice: ['#bfefff', '#4fb8ff'],
  earth: ['#9fd36a', '#4a8a2a'],
  death: ['#555', '#111'],
  holy: ['#fff6b0', '#ffd84a']
};

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
  // Projétil que voa do sqm de origem até o de destino: flecha e lança são um
  // risco apontado pra onde vão; o resto, uma bolinha da cor do tipo.

  spawnMissile(fromX, fromY, toX, toY, renderer, kind = 'energy') {
    this.missiles = this.missiles || [];
    this.missiles.push({ fromX, fromY, toX, toY, renderer, kind, createdAt: performance.now(), duration: 280 });
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
      const shaft = MISSILE_SHAFTS[m.kind];
      if (shaft) {
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.lineWidth = 2;
        ctx.strokeStyle = shaft.color;
        ctx.beginPath();
        ctx.moveTo(-shaft.length / 2, 0);
        ctx.lineTo(shaft.length / 2, 0);
        ctx.stroke();
        ctx.fillStyle = shaft.tip;
        ctx.fillRect(shaft.length / 2 - 2, -2, 4, 4);
      } else {
        const color = MISSILE_COLORS[m.kind] || MISSILE_COLORS.energy;
        ctx.fillStyle = color[0];
        ctx.shadowColor = color[1];
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(x, y, m.kind === 'energy' ? 4 : 5, 0, Math.PI * 2);
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
  }
}