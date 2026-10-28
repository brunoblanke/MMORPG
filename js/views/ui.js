// js/views/ui.js


export class UI {
  constructor() {
    this.devBtnSize = 36;
    this.devBtnPadding = 12;
    this.fullscreenBtnGap = 4;
    // Largura das colunas de janelas (css/inventory.css, --inv-side): elas
    // ficam por cima da tela, então o botão e os avisos vão pra dentro delas.
    this.sideInset = 186;
    this.iconColor = '#ccff33';
    this.iconCache = {};

    this.registerIcon('eye', 24, 24, 24, '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="' + this.iconColor + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>');

    this.registerIcon('eye-closed', 24, 24, 24, '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="' + this.iconColor + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-.722-3.25"/><path d="M2 8a10.645 10.645 0 0 0 20 0"/><path d="m20 15-1.726-2.05"/><path d="m4 15 1.726-2.05"/><path d="m9 18 .722-3.25"/></svg>');

    this.registerIcon('maximize', 24, 24, 24, '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="' + this.iconColor + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>');

    this.registerIcon('minimize', 24, 24, 24, '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="' + this.iconColor + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>');
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

  draw(ctx, devMode) {
    this.drawDevModeButton(ctx, devMode);
    this.drawFullscreenButton(ctx);
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

  // ================================================================================================================================================================================================================================================
  // drawFullscreenButton
  // Ícone de tela cheia ao lado do botão dev.

  drawFullscreenButton(ctx) {
    const icon = this.iconCache[document.fullscreenElement ? 'minimize' : 'maximize'];
    this.drawIcon(ctx, icon, this.fullscreenBtnX(), this.devBtnPadding, this.devBtnSize);
  }

  // ================================================================================================================================================================================================================================================
  // fullscreenBtnX

  fullscreenBtnX() {
    return this.sideInset + this.devBtnPadding + this.devBtnSize + this.fullscreenBtnGap;
  }

  // ================================================================================================================================================================================================================================================
  // isFullscreenButtonClicked

  isFullscreenButtonClicked(mouseX, mouseY) {
    const btnX = this.fullscreenBtnX();
    const btnY = this.devBtnPadding;
    const size = this.devBtnSize;
    return mouseX >= btnX && mouseX <= btnX + size &&
           mouseY >= btnY && mouseY <= btnY + size;
  }
}