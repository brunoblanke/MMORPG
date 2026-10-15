// js/services/wake-lock.js

// ================================================================================================================================================================================================================================================
// keepScreenOn
// Pede ao navegador que a tela não apague enquanto o jogo está aberto (Screen Wake Lock); a trava cai quando a aba fica escondida, então pede de novo ao voltar.

export function keepScreenOn() {
  if (typeof navigator === 'undefined' || !navigator.wakeLock) return;
  let lock = null;
  const request = async () => {
    try {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => { lock = null; });
    } catch (error) {
      lock = null;
    }
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !lock) request();
  });
  request();
}
