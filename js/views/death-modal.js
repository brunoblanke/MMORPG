// js/views/death-modal.js

// Janela de morte (markup em index.html, #deathModal): aparece enquanto o player
// está morto (player.dead) com "Entrar" (volta ao jogo no spawn: comando respawn) e
// "Cancelar" (sai pra tela de entrada, recarregando a página).

export class DeathModal {

  // ================================================================================================================================================================================================================================================
  // constructor

  constructor(game) {
    this.game = game;
    this.root = document.getElementById('deathModal');
    document.getElementById('deathEnter').addEventListener('click', () => this.game.send({ type: 'respawn' }));
    document.getElementById('deathCancel').addEventListener('click', () => location.reload());
  }

  // ================================================================================================================================================================================================================================================
  // update
  // Mostra ou esconde a janela conforme o player está morto.

  update(player) {
    const dead = !!(player && player.dead);
    if (this.root.hidden === !dead) return;
    this.root.hidden = !dead;
    if (dead) document.getElementById('deathEnter').focus();
  }
}
