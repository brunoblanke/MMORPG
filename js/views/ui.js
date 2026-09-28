export class UI {
  constructor() {
    this.devBtnSize = 36;
    this.devBtnPadding = 12;
    // Largura das colunas de janelas (css/inventory.css, --inv-side): elas
    // ficam por cima da tela, então o botão e os avisos vão pra dentro delas.
    this.sideInset = 204;
    this.iconColor = '#ccff33';
    this.iconCache = {};

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
    this.drawDevModeButton(ctx, devMode);
    this.drawPlayerStatus(ctx, player, inSafeZone);
  }

  // ================================================================================================================================================================================================================================================
  // drawPlayerStatus
  // Canto inferior esquerdo: só o aviso de zona segura (nível e XP ficam na
  // janela de skills).

  drawPlayerStatus(ctx, player, inSafeZone) {
    if (!inSafeZone) return;
    const x = this.sideInset + 16;
    const y = ctx.canvas.height - 16;
    const label = '🛡 Zona segura';
    ctx.save();
    ctx.font = 'bold 12px Arial';
    const labelWidth = ctx.measureText(label).width + 16;
    ctx.fillStyle = 'rgba(46, 204, 113, 0.85)';
    ctx.fillRect(x, y - 20, labelWidth, 20);
    ctx.fillStyle = '#0b2e17';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + 8, y - 10);
    ctx.restore();
  }

  // ================================================================================================================================================================================================================================================
  // drawDevModeButton

  drawDevModeButton(ctx, devMode) {
    const btnX = this.sideInset + this.devBtnPadding;
    const btnY = this.devBtnPadding;
    const size = this.devBtnSize;
    const icon = this.iconCache[devMode ? 'eye' : 'eye-closed'];

    this.drawIcon(ctx, icon, btnX, btnY, size);
  }

  // ================================================================================================================================================================================================================================================
  // isDevButtonClicked

  isDevButtonClicked(mouseX, mouseY) {
    const btnX = this.sideInset + this.devBtnPadding;
    const btnY = this.devBtnPadding;
    const size = this.devBtnSize;
    return mouseX >= btnX && mouseX <= btnX + size && 
           mouseY >= btnY && mouseY <= btnY + size;
  }
}