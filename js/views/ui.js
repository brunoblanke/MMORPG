export class UI {
  constructor() {
    this.btnSize = 40;
    this.btnPadding = 20;
    this.devBtnSize = 36;
    this.devBtnPadding = 12;
    this.iconColor = '#ccff33';
    this.iconCache = {};

    this.registerIcon('user', 108.92, 191.98, 24, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108.92 191.98"><g><path fill="' + this.iconColor + '" d="M54.46,41.18c11.37,0,20.59-9.22,20.59-20.59S65.83,0,54.46,0s-20.59,9.22-20.59,20.59,9.22,20.59,20.59,20.59Z"/><path fill="' + this.iconColor + '" d="M107.36,71.45c-.68-1.01-17.06-24.91-52.9-24.91S2.24,70.43,1.56,71.45c-2.14,3.21-2.08,7.4.16,10.53l16.22,22.72c1.81,2.53,4.65,3.88,7.55,3.88,1.86,0,3.74-.56,5.37-1.73.5-.35.94-.76,1.35-1.18l-.05,6.45-5.72,68.71c-.48,5.66,3.74,10.64,9.4,11.11.29.03.58.04.87.04,5.3,0,9.8-4.06,10.25-9.43l5.5-66.08h4.01l5.5,66.08c.47,5.66,5.48,9.9,11.11,9.4,5.66-.47,9.87-5.45,9.4-11.11l-5.72-68.71-.04-6.45c.4.43.85.83,1.35,1.18,1.63,1.16,3.51,1.73,5.37,1.73,2.9,0,5.74-1.35,7.55-3.88l16.22-22.72c2.24-3.14,2.3-7.32.16-10.53ZM32.3,92.93l-11.21-15.71c2.54-2.33,6.33-5.14,11.37-7.49l-.16,23.19ZM76.62,92.93l-.16-23.22c5.06,2.35,8.85,5.17,11.39,7.5l-11.22,15.72Z"/></g></svg>');

    this.registerIcon('footprints', 161.65, 181.2, 20, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 161.65 181.2"><g><path fill="' + this.iconColor + '" d="M122.52,42.51c10.97,5.99,24.72,1.94,30.71-9.03,5.99-10.97,1.94-24.72-9.03-30.71-10.97-5.99-24.72-1.94-30.71,9.03-5.99,10.97-1.94,24.72,9.03,30.71Z"/><path fill="' + this.iconColor + '" d="M69,128.3l-12.08,12.56c-2,2.1-4.66,3.32-7.49,3.64-.4,0-.81.08-1.21.08l-36.28-.24C5.31,144.34-.08,138.92,0,132.31c0-6.71,5.39-12.02,12.02-12.02l31.13.16,8.36-8.68c2.05,3.59,4.82,6.82,8.27,9.46l9.22,7.06Z"/><path fill="' + this.iconColor + '" d="M161.63,89.64c-.24,5.25-4.35,9.44-9.52,9.92-.48.08-1.05.08-1.61.08l-21.94-1.21c-4.03-.24-7.58-2.75-9.19-6.46l-5.24-12.34-22.99,25.08,23.15,17.75c2.82,2.18,4.6,5.48,4.76,9.03l1.53,37.18c.24,6.37-4.52,11.85-10.89,12.42-.16,0-.4.08-.64.08-6.61.24-12.26-4.92-12.5-11.54l-1.37-31.53-30.48-23.31c-8.99-6.88-11.74-19.27-6.43-29.27.84-1.58,1.63-2.96,2.31-3.97,6.85-10.08,15.32-21.94,22.18-30l-9.6-3.71-17.75,9.03c-5.16,2.66-11.53.56-14.2-4.68-2.66-5.16-.57-11.54,4.68-14.2l21.86-11.13c2.66-1.29,5.81-1.45,8.63-.41l26.86,10.33c2.42.97,4.68,2.26,6.69,3.87l10.97,8.71c3.31,2.58,5.89,6.05,7.58,9.92l7.74,18.39,15.49.81c5.81.32,10.24,5.32,9.92,11.13Z"/></g></svg>');

    this.registerIcon('eye', 24, 24, 24, '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="' + this.iconColor + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>');

    this.registerIcon('eye-closed', 24, 24, 24, '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="' + this.iconColor + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-.722-3.25"/><path d="M2 8a10.645 10.645 0 0 0 20 0"/><path d="m20 15-1.726-2.05"/><path d="m4 15 1.726-2.05"/><path d="m9 18 .722-3.25"/></svg>');
  }

  // ================================================================================================================================================================================================================================================
  // registerIcon

  registerIcon(name, viewBoxWidth, viewBoxHeight, maxHeight, svgMarkup) {
    const img = new Image();
    img.src = 'data:image/svg+xml;base64,' + btoa(svgMarkup);
    this.iconCache[name] = {
      image: img,
      aspectRatio: viewBoxWidth / viewBoxHeight,
      maxHeight: maxHeight
    };
  }

  // ================================================================================================================================================================================================================================================
  // drawIcon

  drawIcon(ctx, icon, areaX, areaY, areaSize) {
    if (!icon || !icon.image.complete) return;

    const drawHeight = Math.min(icon.maxHeight, areaSize);
    const drawWidth = drawHeight * icon.aspectRatio;

    const drawX = areaX + (areaSize - drawWidth) / 2;
    const drawY = areaY + (areaSize - drawHeight) / 2;

    ctx.drawImage(icon.image, drawX, drawY, drawWidth, drawHeight);
  }

  // ================================================================================================================================================================================================================================================
  // draw

  draw(ctx, player, devMode, inSafeZone) {
    this.drawAutoFollowButton(ctx, player.autoFollow);
    this.drawDevModeButton(ctx, devMode);
    this.drawPlayerStatus(ctx, player, inSafeZone);
  }

  // ================================================================================================================================================================================================================================================
  // drawPlayerStatus
  // Canto inferior esquerdo: nível, barra de XP até o próximo nível e o
  // aviso de zona segura.

  drawPlayerStatus(ctx, player, inSafeZone) {
    const x = 16;
    const width = 200;
    const barHeight = 8;
    const y = ctx.canvas.height - 16 - barHeight;
    const progress = player.nextLevelXp ? Math.min(1, (player.xp || 0) / player.nextLevelXp) : 0;

    ctx.save();
    ctx.font = 'bold 13px Arial';
    ctx.textBaseline = 'bottom';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#000';
    const text = `Nível ${player.lvl}   XP ${Math.floor(player.xp || 0)} / ${player.nextLevelXp}`;
    ctx.strokeText(text, x, y - 6);
    ctx.fillStyle = '#fff';
    ctx.fillText(text, x, y - 6);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(x, y, width, barHeight);
    ctx.fillStyle = this.iconColor;
    ctx.fillRect(x, y, width * progress, barHeight);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, width - 1, barHeight - 1);

    if (inSafeZone) {
      const label = '🛡 Zona segura';
      ctx.font = 'bold 12px Arial';
      const labelWidth = ctx.measureText(label).width + 16;
      const labelY = y - 30;
      ctx.fillStyle = 'rgba(46, 204, 113, 0.85)';
      ctx.fillRect(x, labelY - 20, labelWidth, 20);
      ctx.fillStyle = '#0b2e17';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x + 8, labelY - 10);
    }
    ctx.restore();
  }

  // ================================================================================================================================================================================================================================================
  // drawAutoFollowButton

  drawAutoFollowButton(ctx, autoFollow) {
    const btnX = ctx.canvas.width - this.btnSize - this.btnPadding;
    const btnY = this.btnPadding;
    const icon = this.iconCache[autoFollow ? 'footprints' : 'user'];

    this.drawIcon(ctx, icon, btnX, btnY, this.btnSize);
  }

  // ================================================================================================================================================================================================================================================
  // drawDevModeButton

  drawDevModeButton(ctx, devMode) {
    const btnX = this.devBtnPadding;
    const btnY = this.devBtnPadding;
    const size = this.devBtnSize;
    const icon = this.iconCache[devMode ? 'eye' : 'eye-closed'];

    this.drawIcon(ctx, icon, btnX, btnY, size);
  }

  // ================================================================================================================================================================================================================================================
  // isButtonClicked

  isButtonClicked(mouseX, mouseY, canvasWidth) {
    const btnX = canvasWidth - this.btnSize - this.btnPadding;
    const btnY = this.btnPadding;
    return mouseX >= btnX && mouseX <= btnX + this.btnSize && 
           mouseY >= btnY && mouseY <= btnY + this.btnSize;
  }

  // ================================================================================================================================================================================================================================================
  // isDevButtonClicked

  isDevButtonClicked(mouseX, mouseY) {
    const btnX = this.devBtnPadding;
    const btnY = this.devBtnPadding;
    const size = this.devBtnSize;
    return mouseX >= btnX && mouseX <= btnX + size && 
           mouseY >= btnY && mouseY <= btnY + size;
  }
}