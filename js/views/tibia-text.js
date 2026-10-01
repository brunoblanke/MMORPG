// js/views/tibia-text.js

// Texto no estilo do Tibia: negrito, cor chapada e contorno preto de 1px
// (o texto em preto deslocado em volta, sem borrar). Usado nos nomes de
// criaturas e players e nas mensagens do centro da tela.

export const TIBIA_FONT = "bold 11px Verdana, Tahoma, 'DejaVu Sans', sans-serif";
const OUTLINE_OFFSETS = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

// ================================================================================================================================================================================================================================================
// drawTibiaText
// Escreve text centrado em (x, y) com a base em y (textBaseline bottom).

export function drawTibiaText(ctx, text, x, y, color) {
  const px = Math.round(x);
  const py = Math.round(y);
  ctx.save();
  ctx.font = TIBIA_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = '#000000';
  for (const [dx, dy] of OUTLINE_OFFSETS) ctx.fillText(text, px + dx, py + dy);
  ctx.fillStyle = color;
  ctx.fillText(text, px, py);
  ctx.restore();
}

// ================================================================================================================================================================================================================================================
// healthColor
// Cor do nome e da barra pela vida, nas faixas do Tibia.

export function healthColor(fraction) {
  if (fraction > 0.92) return '#00c000';
  if (fraction > 0.6) return '#60c060';
  if (fraction > 0.3) return '#c0c000';
  if (fraction > 0.08) return '#c03030';
  if (fraction > 0.03) return '#c00000';
  return '#600000';
}
