// js/views/inventory-ui/icons.js

// Ícones de linha das janelas (espaços vazios do inventário, seguir e
// auto ataque, e os botões pequenos do cabeçalho).

// ================================================================================================================================================================================================================================================
// svgIcon
// Ícones de linha (copiados de SVGs desenhados à parte): o traço segue a cor do
// texto (currentColor). Todos do mesmo grupo usam a mesma escala, então
// mantêm a proporção e o tamanho relativo de quando foram desenhados;
// shrink diminui um ícone sem afinar o traço.

export function svgIcon(viewBox, shapes, scale, cls = '', shrink = 1) {
  const [, , w, h] = viewBox.split(' ').map(Number);
  const size = scale * shrink;
  return `<svg${cls ? ` class="${cls}"` : ''} width="${(w * size).toFixed(1)}" height="${(h * size).toFixed(1)}" viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="${(1.91 / shrink).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round">${shapes}</svg>`;
}

const SLOT_ICON_SCALE = 22 / 23.36;
const MODE_ICON_SCALE = 11 / 19.84;

export const ICONS = {
  amuleto: svgIcon('0 0 16.21 23.36', '<path d="M.95.95c0,7.15,3.58,10.73,7.15,13.11,3.58-2.38,7.15-5.96,7.15-13.11"/><circle cx="8.11" cy="18.83" r="3.58"/>', SLOT_ICON_SCALE, 'inv-hint', 0.8),
  cabeca: svgIcon('0 0 18.59 16.21', '<path d="M.95,9.3C.95,4.69,4.69.95,9.3.95s8.34,3.74,8.34,8.34v3.58H.95v-3.58Z"/><path d="M4.53,12.87v2.38M14.06,12.87v2.38"/>', SLOT_ICON_SCALE, 'inv-hint'),
  mochila: svgIcon('0 0 17.72 21', '<path d="M16.77,14.6c0,4.37-3.54,5.44-7.91,5.44S.95,18.97.95,14.6s3.54-7.91,7.91-7.91,7.91,3.54,7.91,7.91Z"/><polyline points="6.08 4.59 4.85 .95 6.61 2.18 8.86 .95 10.89 2.18 12.87 .95 11.64 4.59"/>', SLOT_ICON_SCALE, 'inv-hint'),
  arma: svgIcon('0 0 23.36 23.36', '<path d="M14.66,18.24L.95,4.53V.95h3.58l13.71,13.71"/><path d="M12.87,20.02l7.15-7.15"/><path d="M16.45,16.45l4.77,4.77"/><path d="M20.02,22.41l2.38-2.38"/>', SLOT_ICON_SCALE, 'inv-hint'),
  corpo: svgIcon('0 0 20.98 20.98', '<path d="M5.72.95l4.77,2.38L15.26.95l4.77,4.77-3.58,3.58v10.73H4.53v-10.73L.95,5.72,5.72.95Z"/>', SLOT_ICON_SCALE, 'inv-hint'),
  escudo: svgIcon('0 0 18.59 23.36', '<path d="M9.3.95l8.34,3.58v5.96c0,5.96-3.58,9.54-8.34,11.92C4.53,20.02.95,16.45.95,10.49v-5.96L9.3.95Z"/>', SLOT_ICON_SCALE, 'inv-hint'),
  anel: svgIcon('0 0 16.21 22.17', '<circle cx="8.11" cy="14.06" r="7.15"/><path d="M5.72,4.53l2.38-3.58,2.38,3.58"/>', SLOT_ICON_SCALE, 'inv-hint', 0.8),
  pernas: svgIcon('0 0 13.83 20.98', '<path d="M.95.95h11.92l-1.19,19.07h-3.58l-1.19-11.92-1.19,11.92h-3.58L.95.95Z"/>', SLOT_ICON_SCALE, 'inv-hint'),
  municao: svgIcon('0 0 15.59 15.59', '<path d="M.95,14.63L13.44,2.15M8.68.95h5.96v5.96"/>', SLOT_ICON_SCALE, 'inv-hint'),
  pes: svgIcon('0 0 16.21 19.79', '<path d="M.95.95h5.96v10.73l8.34,2.38v4.77H.95V.95Z"/>', SLOT_ICON_SCALE, 'inv-hint', 0.8)
};
export const FOLLOW_ICONS = {
  follow: svgIcon('0 0 17.4 19.84', '<circle cx="14.06" cy="3.34" r="2.38"/><path d="M5.13,7.57l4.17-2.38,3.58,3.58,3.58.6"/><path d="M8.82,11.84l4.05,1.09-1.19,5.96"/><path d="M11.32,7.2l-5,6.92-5.36,1.19"/>', MODE_ICON_SCALE),
  attack: svgIcon('0 0 19.79 19.19', '<path d="M1.55.95l13.11,13.11M18.24.95L5.13,14.06"/><path d="M12.28,16.45l4.77-4.77M2.74,11.68l4.77,4.77"/><path d="M15.85,15.26l2.98,2.98M3.93,15.26l-2.98,2.98"/>', MODE_ICON_SCALE),
  stand: svgIcon('0 0 11.44 19.84', '<circle cx="5.72" cy="3.4" r="2.44"/><path d="M5.72,8.76v4.17"/><path d="M.95,9.95l4.77-1.79,4.77,1.79"/><path d="M5.72,12.93l-4.17,5.96"/><path d="M5.72,12.93l4.17,5.96"/>', MODE_ICON_SCALE)
};

const BUTTON_ICON = (shapes) => `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${shapes}</svg>`;

export const BUTTON_ICONS = {
  plus: BUTTON_ICON('<path d="M5 1.5v7M1.5 5h7"/>'),
  minus: BUTTON_ICON('<path d="M1.5 5h7"/>'),
  close: BUTTON_ICON('<path d="M2 2l6 6M8 2l-6 6"/>'),
  up: BUTTON_ICON('<path d="M5 8.5v-7M2 4.5l3-3 3 3"/>'),
  mail: BUTTON_ICON('<rect x="1" y="2.5" width="8" height="5.5" rx="1"/><path d="M1.5 3l3.5 2.6L8.5 3"/>')
};
