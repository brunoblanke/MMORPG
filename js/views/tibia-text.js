// js/views/tibia-text.js

// Texto no estilo do Tibia: negrito, cor chapada e contorno preto de 1px
// (o texto em preto deslocado em volta, sem borrar). Usado nos nomes de
// criaturas e players e nas mensagens do centro da tela.

export const TIBIA_FONT = "bold 11px Verdana, Tahoma, 'DejaVu Sans', sans-serif";
const OUTLINE_OFFSETS = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

// ================================================================================================================================================================================================================================================
// drawTibiaText
// Escreve text centrado em (x, y) com a base em y (textBaseline bottom), com
// contorno preto (ou da cor outline).

export function drawTibiaText(ctx, text, x, y, color, outline = '#000000') {
  const px = Math.round(x);
  const py = Math.round(y);
  ctx.save();
  ctx.font = TIBIA_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = outline;
  for (const [dx, dy] of OUTLINE_OFFSETS) ctx.fillText(text, px + dx, py + dy);
  ctx.fillStyle = color;
  ctx.fillText(text, px, py);
  ctx.restore();
}

// ================================================================================================================================================================================================================================================
// healthColor
// Cor da barra pela vida: a mesma da janela de battle.

export function healthColor(fraction) {
  if (fraction <= 0.25) return '#ef4444';
  if (fraction <= 0.5) return '#eab308';
  return '#22c55e';
}
