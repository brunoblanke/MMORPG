// js/views/inventory-ui/drag.js

import { objectIdType } from '../../../shared/assets.js';
import { fitsSlot } from '../../../shared/items.js';

// Métodos do InventoryUI (js/views/inventory-ui.js). Arrastar itens entre os
// espaços, as janelas e o chão: onde o item pode ir, quanto da pilha e o
// comando moveInv.

export const dragMethods = {

  // ================================================================================================================================================================================================================================================
  // dropGroundOn
  // Item arrastado da tela do jogo (mouse ou dedo) solto no espaço slot.

  dropGroundOn(slot, evt) {
    const input = this.game.inputController;
    if (!input || !input.draggingCandidate || !input.dragOccurred) return;
    const obj = input.draggingCandidate;
    input.draggingCandidate = null;
    input.dragOccurred = false;
    input.dragStartMouse = null;
    if (!slot || obj.isCorpse || !this.canDropOn(objectIdType(obj.id), null, this.placeOf(slot))) return;
    this.sendMove({ t: 'g', id: obj.id }, this.placeOf(slot), obj.count || 1, evt);
  },

  // ================================================================================================================================================================================================================================================
  // placeOf
  // data-place do espaço → lugar do comando.

  placeOf(el) {
    const [t, a, b] = el.dataset.place.split(':');
    return t === 'e' ? { t, key: a } : { t, uid: a, i: Number(b) };
  },

  // ================================================================================================================================================================================================================================================
  // itemAt

  itemAt(place) {
    if (place.t === 'e') return this.view.equip[place.key];
    const box = this.findContainer(place.uid);
    return box ? box.items[place.i] : null;
  },

  // ================================================================================================================================================================================================================================================
  // worldDrop
  // Sqm do chão sob o mouse (no andar do piso que aparece ali), ou null.

  worldDrop(evt) {
    const canvas = this.game.canvas;
    if (evt.target !== canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const grid = this.game.camera.screenToGrid(evt.clientX - rect.left, evt.clientY - rect.top);
    const z = this.game.getVisibleFloorAt(grid.x, grid.y);
    return z === null ? null : { t: 'w', x: grid.x, y: grid.y, z };
  },

  // ================================================================================================================================================================================================================================================
  // sendMove
  // Manda o movimento; com Shift numa pilha, pergunta a quantidade antes.

  sendMove(from, to, count, evt) {
    const send = (amount) => this.game.send({ type: 'moveInv', from, to, amount });
    if (evt.shiftKey && count > 1) this.askAmount(count, evt, send);
    else send(count || 1);
  },

  // ================================================================================================================================================================================================================================================
  // askAmount

  askAmount(max, evt, onConfirm) {
    this.closeQty();
    const box = document.createElement('div');
    box.className = 'inv-qty';
    const half = Math.ceil(max / 2);
    box.innerHTML = `<span>Quantos mover?</span>
      <div class="row"><input id="invQtyRange" type="range" min="1" max="${max}" value="${half}">
        <input id="invQtyNumber" type="number" min="1" max="${max}" value="${half}" aria-label="Quantidade"></div>
      <div class="row"><button type="button" data-qty="cancel">Cancelar</button><button type="button" class="primary" data-qty="ok">Mover</button></div>`;
    document.body.appendChild(box);
    box.style.left = `${Math.min(evt.clientX + 12, window.innerWidth - 236)}px`;
    box.style.top = `${Math.min(evt.clientY + 12, window.innerHeight - 140)}px`;
    const range = box.querySelector('#invQtyRange');
    const number = box.querySelector('#invQtyNumber');
    range.oninput = () => { number.value = range.value; };
    number.oninput = () => { range.value = number.value; };
    const ok = () => {
      const n = Math.max(1, Math.min(max, parseInt(number.value || '1', 10)));
      this.closeQty();
      onConfirm(n);
    };
    box.querySelector('[data-qty="ok"]').onclick = ok;
    box.querySelector('[data-qty="cancel"]').onclick = () => this.closeQty();
    number.onkeydown = (e) => { if (e.key === 'Enter') ok(); if (e.key === 'Escape') this.closeQty(); };
    number.focus();
    number.select();
    this.qty = box;
  },

  closeQty() {
    if (this.qty) this.qty.remove();
    this.qty = null;
  },

  // ================================================================================================================================================================================================================================================
  // startItemDrag

  startItemDrag(evt, from, item, sourceEl) {
    const ghost = document.createElement('div');
    ghost.className = 'inv-ghost';
    ghost.innerHTML = this.spriteHtml(item.type, item.count);
    document.body.appendChild(ghost);
    sourceEl.classList.add('source');
    document.querySelectorAll('.inv-slot').forEach(el => {
      if (el !== sourceEl && this.canDropOn(item.type, item.uid, this.placeOf(el))) el.classList.add('can-drop');
    });
    this.drag = { kind: 'item', from, item, ghost, sourceEl };
    this.moveGhost(evt);
  },

  moveGhost(evt) {
    this.drag.ghost.style.left = `${evt.clientX + 6}px`;
    this.drag.ghost.style.top = `${evt.clientY + 6}px`;
    const slot = document.elementFromPoint(evt.clientX, evt.clientY)?.closest('.inv-slot');
    const { item } = this.drag;
    this.markSlot(slot && slot !== this.drag.sourceEl ? slot : null, (place) => this.canDropOn(item.type, item.uid, place));
  },

  // ================================================================================================================================================================================================================================================
  // markSlot
  // Espaço sob o item arrastado: borda verde se ele vai ali, vermelha se não.

  markSlot(slot, accepts) {
    document.querySelectorAll('.inv-slot.over').forEach(el => el.classList.remove('over', 'reject'));
    if (!slot) return;
    slot.classList.add('over');
    if (!accepts(this.placeOf(slot))) slot.classList.add('reject');
  },

  // ================================================================================================================================================================================================================================================
  // canDropOn
  // O item (tipo, uid) pode ir pro espaço? Container aceita qualquer um (vai
  // pro primeiro vazio); o espaço do inventário, só o que é dele — ou, o da
  // mochila, qualquer item que caiba dentro dela.

  canDropOn(type, uid, place) {
    if (!type || !place) return false;
    if (place.t === 'c') return true;
    const bag = this.view && this.view.equip.mochila;
    if (place.key === 'mochila' && bag && bag.items && bag.uid !== uid) return true;
    return fitsSlot(type, place.key);
  },

  endItemDrag(evt) {
    const { from, item, ghost } = this.drag;
    ghost.remove();
    document.querySelectorAll('.inv-slot').forEach(el => el.classList.remove('can-drop', 'over', 'reject', 'source'));
    this.drag = null;
    const target = document.elementFromPoint(evt.clientX, evt.clientY);
    if (target && target.closest('[data-trade-drop]')) {
      if (from.t === 'e' || from.t === 'c') this.game.send({ type: 'tradeOffer', from });
      this.lastKey = '';
      return;
    }
    const slot = target && target.closest('.inv-slot');
    if (slot && !this.canDropOn(item.type, item.uid, this.placeOf(slot))) return;
    const to = slot ? this.placeOf(slot) : this.worldDrop({ target, clientX: evt.clientX, clientY: evt.clientY });
    if (to) this.sendMove(from, to, item.count || 1, evt);
    this.lastKey = '';
  },
};
