// js/views/inventory-ui/aim.js

import { objectIdType, objectUse } from '../../../shared/assets.js';
import { itemInfo, isSwitchableLight } from '../../../shared/items.js';
import { MAP_USES } from './common.js';

// Métodos do InventoryUI (js/views/inventory-ui.js). Mira (potion, corda, pá) e o que está sob o mouse na tela do jogo:
// caixa pra abrir, item pra usar, item arrastado do chão.

export const aimMethods = {

  // ================================================================================================================================================================================================================================================
  // openableUnderMouse
  // Caixa ou cadáver sob o mouse na tela do jogo (o que o duplo clique abre).

  openableUnderMouse() {
    const input = this.game.inputController;
    if (!input) return null;
    if (input.hoverCorpse) return input.hoverCorpse;
    const obj = input.hoverObject;
    if (!obj || objectUse(objectIdType(obj.id)) || !itemInfo(objectIdType(obj.id)).size) return null;
    return obj;
  },

  // ================================================================================================================================================================================================================================================
  // startAim
  // Potion clicada: o cursor vira mira até o próximo clique (Esc ou botão
  // direito cancelam).

  startAim(from) {
    this.aim = { from, at: performance.now() };
    document.body.classList.add('inv-aiming');
  },

  // ================================================================================================================================================================================================================================================
  // stopAim

  stopAim() {
    this.aim = null;
    document.body.classList.remove('inv-aiming');
  },

  // ================================================================================================================================================================================================================================================
  // aimTarget
  // Sqm apontado na tela: o do player sob o mouse (o desenho dele passa do
  // sqm) ou o do chão; null fora do mapa.

  aimTarget(evt) {
    const { canvas, camera, renderer, session } = this.game;
    const rect = canvas.getBoundingClientRect();
    const mouseX = evt.clientX - rect.left;
    const mouseY = evt.clientY - rect.top;
    const offset = camera.getOffset();
    const z = (this.game.player && this.game.player.z) || 0;
    const player = session.players.find(p => (p.z || 0) === z && renderer.isPointInCube(mouseX, mouseY, p.renderX, p.renderY, offset, p.z || 0, p.step || 0));
    if (player) return { x: player.x, y: player.y, z };
    const grid = camera.screenToGrid(mouseX, mouseY);
    return Number.isInteger(grid.x) && Number.isInteger(grid.y) ? { x: grid.x, y: grid.y, z } : null;
  },

  // ================================================================================================================================================================================================================================================
  // bindAim
  // Com a mira ligada, o próximo clique na tela do jogo usa a potion no sqm
  // (player ou chão) e não anda; clique fora da tela cancela.

  bindAim() {
    const swallow = (evt) => {
      if (!this.swallowClick) return;
      evt.stopImmediatePropagation();
      evt.preventDefault();
    };
    document.addEventListener('pointerdown', (evt) => {
      if (!this.aim || performance.now() - this.aim.at < 50) return;
      const aim = this.aim;
      const slot = evt.target.closest && evt.target.closest('.inv-slot');
      if (slot && JSON.stringify(this.placeOf(slot)) === JSON.stringify(aim.from)) {
        evt.stopImmediatePropagation();
        this.swallowClick = true;
        setTimeout(() => { this.swallowClick = false; }, 400);
        return;
      }
      this.stopAim();
      this.swallowClick = true;
      setTimeout(() => { this.swallowClick = false; }, 400);
      evt.stopImmediatePropagation();
      evt.preventDefault();
      if (evt.button !== 0 || evt.target !== this.game.canvas) return;
      const target = this.aimTarget(evt);
      if (target) this.game.send({ type: 'useItem', from: aim.from, target });
    }, true);
    for (const type of ['mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu']) document.addEventListener(type, swallow, true);
    document.addEventListener('keydown', (evt) => {
      if (evt.key === 'Escape' && this.aim) this.stopAim();
    });
  },

  // ================================================================================================================================================================================================================================================
  // usableUnderMouse
  // Comida ou potion no chão, objeto com uso de mapa ou luz fixa (poste) sob
  // o mouse (duplo clique ou botão direito usa; o player anda até o lado se
  // estiver longe).

  usableUnderMouse() {
    const input = this.game.inputController;
    const obj = input && !input.hoverCorpse ? input.hoverObject : null;
    if (!obj) return null;
    if (MAP_USES.includes(objectUse(objectIdType(obj.id)))) return obj;
    if (obj.movable !== true) return isSwitchableLight(objectIdType(obj.id)) ? obj : null;
    const info = itemInfo(objectIdType(obj.id));
    return info.food || info.heal || info.light || objectUse(objectIdType(obj.id)) ? obj : null;
  },

  // ================================================================================================================================================================================================================================================
  // updateGroundGhost
  // Item arrastado da tela do jogo: o desenho dele segue o mouse, no canto
  // inferior direito, e os espaços que aceitam o item ficam destacados, como
  // no arrastar das janelas.

  updateGroundGhost() {
    const input = this.game.inputController;
    const obj = input && input.dragOccurred ? input.draggingCandidate : null;
    if (!obj) {
      if (this.groundGhost) {
        this.groundGhost.remove();
        this.markSlot(null);
        document.querySelectorAll('.inv-slot.can-drop').forEach(el => el.classList.remove('can-drop'));
      }
      this.groundGhost = null;
      return;
    }
    const accepts = (place) => !obj.isCorpse && this.canDropOn(objectIdType(obj.id), null, place);
    document.querySelectorAll('.inv-slot').forEach(el => el.classList.toggle('can-drop', accepts(this.placeOf(el))));
    const slot = document.elementFromPoint(this.mouse.x, this.mouse.y)?.closest('.inv-slot');
    this.markSlot(slot || null, accepts);
    if (!this.groundGhost) {
      this.groundGhost = document.createElement('div');
      this.groundGhost.className = 'inv-ghost';
      this.groundGhost.innerHTML = obj.isCorpse ? this.corpseSpriteHtml(obj) : this.spriteHtml(objectIdType(obj.id), obj.count);
      document.body.appendChild(this.groundGhost);
    }
    this.groundGhost.style.left = `${this.mouse.x + 6}px`;
    this.groundGhost.style.top = `${this.mouse.y + 6}px`;
  },
};
