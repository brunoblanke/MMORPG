// editor/js/view/mobile-layout.js

// Celular (em pé ou deitado, MOBILE_QUERY, a mesma do CSS): as janelas das ferramentas ficam numa fileira logo abaixo da barra do topo, que quebra linha e muda de
// altura; a variável CSS --quickbar-bottom diz onde a barra termina, e a janela que abre aparece inteira (revealOpenTool).

export const MOBILE_QUERY = '(max-width: 700px), (max-height: 500px) and (pointer: coarse)';

// ================================================================================================================================================================================================================================================
// trackQuickbar

function trackQuickbar() {
  const bar = document.getElementById('quickbar');
  if (!bar) return;
  const update = () => document.documentElement.style.setProperty('--quickbar-bottom', `${Math.round(bar.getBoundingClientRect().bottom)}px`);
  new ResizeObserver(update).observe(bar);
  window.addEventListener('resize', update);
  update();
}

// ================================================================================================================================================================================================================================================
// revealOpenTool
// Celular: rola a fileira até a janela que acabou de abrir aparecer inteira.

export function revealOpenTool() {
  if (!window.matchMedia(MOBILE_QUERY).matches) return;
  const open = document.querySelector('#tools .ed-win.open');
  if (open) open.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
}

trackQuickbar();
