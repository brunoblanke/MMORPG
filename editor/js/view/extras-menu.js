// editor/js/view/extras-menu.js

// Botão Extras (barra de baixo, ao lado do Salvar): abre e fecha o menu com o Simulator, Players de teste e Baixar;
// escolher uma opção ou clicar fora fecha.

// ================================================================================================================================================================================================================================================
// setupExtrasMenu

function setupExtrasMenu() {
  const button = document.getElementById('extrasBtn');
  const menu = document.getElementById('extrasMenu');
  if (!button || !menu) return;
  const setOpen = (open) => {
    menu.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
  };
  button.addEventListener('click', (evt) => {
    evt.stopPropagation();
    setOpen(menu.hidden);
  });
  menu.addEventListener('click', () => setOpen(false));
  document.addEventListener('pointerdown', (evt) => {
    if (!menu.hidden && !evt.target.closest('#extras')) setOpen(false);
  });
}

setupExtrasMenu();
