// js/services/wake-lock.js

// ================================================================================================================================================================================================================================================
// keepScreenOn
// Pede ao navegador que a tela não apague enquanto o jogo está aberto (Screen Wake Lock). Alguns celulares só aceitam depois de um toque ou tecla, então tenta de novo no primeiro toque; a trava cai quando a aba fica escondida, então pede de novo ao voltar.

export function keepScreenOn() {
  if (typeof navigator === 'undefined' || !navigator.wakeLock) return;
  let lock = null;
  let asking = false;
  const request = async () => {
    if (lock || asking || document.visibilityState !== 'visible') return;
    asking = true;
    try {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => { lock = null; });
    } catch (error) {
      lock = null;
    }
    asking = false;
  };
  document.addEventListener('visibilitychange', request);
  for (const type of ['pointerdown', 'touchend', 'keydown']) document.addEventListener(type, request, { passive: true });
  request();
}
