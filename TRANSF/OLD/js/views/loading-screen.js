// js/views/loading-screen.js

export class LoadingScreen {
  constructor() {
    this.active = false;
    this.progress = 0;
    this.total = 0;
  }

  // ================================================================================================================================================================================================================================================
  // show

  show() {
    this.active = true;
    this.progress = 0;
    this.total = 0;
  }

  // ================================================================================================================================================================================================================================================
  // hide

  hide() {
    this.active = false;
  }

  // ================================================================================================================================================================================================================================================
  // setProgress

  setProgress(loaded, total) {
    this.progress = loaded;
    this.total = total;
  }

  // ================================================================================================================================================================================================================================================
  // render

  render(ctx, canvas) {
    if (!this.active) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.fillRect(0, 0, width, height);

    const barWidth = 300;
    const barHeight = 20;
    const barX = (width - barWidth) / 2;
    const barY = (height - barHeight) / 2 + 20;

    ctx.fillStyle = "#333";
    ctx.fillRect(barX, barY, barWidth, barHeight);

    const progress = this.total > 0 ? this.progress / this.total : 0;
    ctx.fillStyle = "#4CAF50";
    ctx.fillRect(barX, barY, barWidth * progress, barHeight);

    ctx.strokeStyle = "#666";
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    ctx.fillStyle = "#FFF";
    ctx.font = "16px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(`Carregando... ${Math.round(progress * 100)}%`, width / 2, barY - 10);

    ctx.restore();
  }
}