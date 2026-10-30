// editor/js/view/fullscreen.js

// Botão de tela cheia (barra transparente acima da barra de baixo, à direita): liga e desliga a tela cheia e troca o
// ícone; some no navegador que não deixa (iPhone).

// ================================================================================================================================================================================================================================================
// setupFullscreen

function setupFullscreen() {
  const button = document.getElementById('fullscreenBtn');
  const root = document.documentElement;
  if (!button || !root.requestFullscreen) return;
  button.hidden = false;
  const update = () => {
    const on = !!document.fullscreenElement;
    button.classList.toggle('on', on);
    button.title = on ? 'Sair da tela cheia' : 'Tela cheia';
  };
  button.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else root.requestFullscreen().catch(() => {});
  });
  document.addEventListener('fullscreenchange', update);
  update();
}

setupFullscreen();
