// js/views/inventory-ui.js

import { objectIdType, objectUse } from '../../shared/assets.js';
import { itemInfo } from '../../shared/items.js';
import { describeItem, describeEntity } from './look.js';
import { PITCH, MAP_USES, LONG_PRESS_MS, aimsWith } from './inventory-ui/common.js';
import { patchChildren } from './inventory-ui/dom-patch.js';
import { htmlMethods } from './inventory-ui/html.js';
import { windowMethods } from './inventory-ui/windows.js';
import { aimMethods } from './inventory-ui/aim.js';
import { dragMethods } from './inventory-ui/drag.js';

// Janelas do inventário, dos containers, skills, battle e livro: nas duas
// colunas ao lado da tela do jogo ou soltas por cima dela. Só desenha e manda comandos (moveInv, openContainer, closeContainer,
// saveLayout); quem decide se o movimento vale é o servidor (systems/inventory.js).
// O layout (coluna, ordem, linhas, minimizada) vai pro personagem guardado:
// as janelas são lembradas pelo caminho do container ('mochila/3' = espaço 3
// da mochila), já que os uids mudam a cada vez que o personagem entra.

export class InventoryUI {
  // ================================================================================================================================================================================================================================================
  // constructor

  constructor(game) {
    this.game = game;
    this.columns = { left: document.getElementById('invLeft'), right: document.getElementById('invRight') };
    this.freeLayer = document.getElementById('invFree');
    this.layout = null;
    this.view = null;
    this.lastKey = '';
    this.openedGround = new Set();
    this.scrollMemory = new Map();
    this.pending = null;
    this.drag = null;
    this.qty = null;
    this.saveTimer = null;
    this.groundGhost = null;
    this.mouse = { x: 0, y: 0 };
    this.bindEvents();
  }

  // ================================================================================================================================================================================================================================================
  // update
  // A cada quadro: pega o inventário da sessão e redesenha se mudou.

  update() {
    this.updateGroundGhost();
    const view = this.game.session && this.game.session.inventoryView;
    if (!view) return;
    this.view = view;
    if (!this.layout) this.layout = this.initialLayout(view);
    this.syncGroundWindows(view);
    this.syncTradeWindow(view);
    this.dropMissingWindows();
    const player = this.game.player;
    this.battle = this.findWindow('battle') ? this.battleList() : [];
    const modes = player ? [player.followMode, player.attackMode] : null;
    const key = JSON.stringify([view.equip, view.cap, view.opened, view.stats, view.social, this.layout, modes, this.battle]);
    if (key === this.lastKey || this.drag) return;
    this.lastKey = key;
    this.render();
  }

  // ================================================================================================================================================================================================================================================
  // toggleBar
  // Clique numa linha dos skills mostra ou esconde a barra de progresso dela
  // (a escolha fica guardada no layout).

  toggleBar(winId, key) {
    const found = this.findWindow(winId);
    if (!found || !key) return;
    const bars = new Set(found.win.bars || []);
    if (bars.has(key)) bars.delete(key);
    else bars.add(key);
    found.win.bars = [...bars];
    this.scheduleSave();
    this.lastKey = '';
  }

  // ================================================================================================================================================================================================================================================
  // render

  // Só mexe no que mudou (patchChildren): o elemento sob o mouse continua o
  // mesmo, então o hover não pisca quando o estado muda.

  render() {
    if (!this.view || !this.layout) return;
    document.querySelectorAll('.inv-scroller').forEach(sc => this.scrollMemory.set(sc.closest('.inv-win').dataset.win, sc.scrollTop));
    for (const col of ['left', 'right']) {
      const next = document.createElement('div');
      next.innerHTML = this.layout[col].map(w => this.windowHtml(w)).join('');
      patchChildren(this.columns[col], next);
    }
    const free = document.createElement('div');
    free.innerHTML = this.layout.free.map(w => this.windowHtml(w).replace('<section ', `<section style="left:${Math.round(w.x)}px;top:${Math.round(w.y)}px" `)).join('');
    patchChildren(this.freeLayer, free);
    document.querySelectorAll('.inv-scroller').forEach(sc => {
      sc.scrollTop = this.scrollMemory.get(sc.closest('.inv-win').dataset.win) || 0;
      this.updateFade(sc);
      if (sc.dataset.fadeBound) return;
      sc.dataset.fadeBound = '1';
      sc.addEventListener('scroll', () => this.updateFade(sc), { passive: true });
    });
  }

  // ================================================================================================================================================================================================================================================
  // updateFade
  // Sombra em cima/embaixo quando tem mais itens pra rolar (a barra é invisível).

  updateFade(sc) {
    const body = sc.parentElement;
    body.classList.toggle('more-up', sc.scrollTop > 2);
    body.classList.toggle('more-down', sc.scrollTop + sc.clientHeight < sc.scrollHeight - 2);
  }

  // ================================================================================================================================================================================================================================================
  // startLongPress / stopLongPress
  // Celular: segurar o dedo parado num item ou numa criatura da battle por
  // LONG_PRESS_MS olha (como Shift + clique) e não arrasta nem usa.

  startLongPress(evt) {
    this.stopLongPress();
    const slot = evt.target.closest('.inv-slot.filled');
    const row = evt.target.closest('.inv-battle-row');
    if (!slot && !row) return;
    const timer = setTimeout(() => {
      this.press = null;
      this.pending = null;
      if (slot) {
        const item = this.itemAt(this.placeOf(slot));
        if (item) this.game.look(describeItem(item));
      } else {
        const enemy = this.game.session && this.game.session.enemies.find(e => e.id === row.dataset.enemy);
        if (enemy) this.game.look(describeEntity(enemy));
      }
    }, LONG_PRESS_MS);
    this.press = { x: evt.clientX, y: evt.clientY, timer, row: row ? row.dataset.enemy : null };
  }

  stopLongPress() {
    if (this.press) clearTimeout(this.press.timer);
    this.press = null;
  }

  // ================================================================================================================================================================================================================================================
  // toggleTarget
  // Clique na criatura da battle: vira o alvo (ou deixa de ser).

  toggleTarget(enemyId) {
    const target = this.game.player && this.game.player.target;
    this.game.send({ type: 'attack', targetId: target && target.id === enemyId ? null : enemyId });
  }

  // ================================================================================================================================================================================================================================================
  // bindEvents

  bindEvents() {
    const panels = [...Object.values(this.columns), this.freeLayer];
    const inPanels = (el) => panels.some(p => p.contains(el));
    this.bindAim();

    document.addEventListener('keydown', (evt) => {
      if (evt.key !== 'Escape' || !this.layout || !this.findWindow('book')) return;
      this.removeWindows(w => w.kind === 'book');
      this.lastKey = '';
    });

    document.addEventListener('pointerdown', (evt) => {
      if (this.qty && !evt.target.closest('.inv-qty')) this.closeQty();
      if (evt.button !== 0 || !inPanels(evt.target) || evt.target.closest('.inv-btn')) return;
      if (evt.pointerType === 'touch') this.startLongPress(evt);
      const row = evt.target.closest('.inv-battle-row');
      if (row && evt.pointerType === 'touch') return;
      if (row && evt.shiftKey) {
        const enemy = this.game.session && this.game.session.enemies.find(e => e.id === row.dataset.enemy);
        if (enemy) this.game.look(describeEntity(enemy));
        return;
      }
      if (row) {
        this.toggleTarget(row.dataset.enemy);
        return;
      }
      const slot = evt.target.closest('.inv-slot.filled');
      if (slot) {
        const from = this.placeOf(slot);
        this.pending = { kind: 'item', x: evt.clientX, y: evt.clientY, from, item: this.itemAt(from), el: slot };
        return;
      }
      const head = evt.target.closest('.inv-head');
      if (head) {
        this.pending = { kind: 'win', x: evt.clientX, y: evt.clientY, winId: head.closest('.inv-win').dataset.win };
        return;
      }
      const handle = evt.target.closest('.inv-resize');
      if (handle) {
        const found = this.findWindow(handle.closest('.inv-win').dataset.win);
        const box = found && this.findContainer(found.win.uid);
        if (!box) return;
        this.drag = { kind: 'resize', win: found.win, y0: evt.clientY, rows0: found.win.rows, max: Math.ceil(box.items.length / 4) };
        evt.preventDefault();
      }
    });

    document.addEventListener('pointermove', (evt) => {
      this.mouse.x = evt.clientX;
      this.mouse.y = evt.clientY;
      if (this.press && Math.hypot(evt.clientX - this.press.x, evt.clientY - this.press.y) > 5) this.stopLongPress();
      if (this.pending && !this.drag) {
        if (Math.hypot(evt.clientX - this.pending.x, evt.clientY - this.pending.y) < 5) return;
        const p = this.pending;
        this.pending = null;
        if (p.kind === 'item' && p.item) this.startItemDrag(evt, p.from, p.item, p.el);
        else if (p.kind === 'win') this.startWinDrag(evt, p.winId);
      }
      if (!this.drag) return;
      if (this.drag.kind === 'item') this.moveGhost(evt);
      else if (this.drag.kind === 'win') this.moveWinDrag(evt);
      else if (this.drag.kind === 'resize') {
        const rows = Math.max(1, Math.min(this.drag.max, this.drag.rows0 + Math.round((evt.clientY - this.drag.y0) / PITCH)));
        if (rows !== this.drag.win.rows) {
          this.drag.win.rows = rows;
          this.render();
        }
      }
    });

    document.addEventListener('pointerup', (evt) => {
      if (this.press && this.press.row) this.toggleTarget(this.press.row);
      this.stopLongPress();
      const clicked = this.pending && this.pending.kind === 'item' && !this.drag ? this.pending : null;
      this.pending = null;
      if (clicked && evt.button === 0 && clicked.item && evt.shiftKey) {
        this.game.look(describeItem(clicked.item));
        return;
      }
      if (clicked && evt.button === 0 && clicked.item && !clicked.item.items && aimsWith(clicked.item.type)) {
        this.startAim(clicked.from);
        return;
      }
      if (!this.drag) return;
      if (this.drag.kind === 'item') this.endItemDrag(evt);
      else if (this.drag.kind === 'win') this.endWinDrag();
      else { this.drag = null; this.scheduleSave(); this.lastKey = ''; }
    });

    // Item arrastado da tela do jogo e solto numa janela (a tela não recebe o mouseup).
    document.addEventListener('mouseup', (evt) => {
      const slot = evt.target.closest && evt.target.closest('.inv-slot');
      this.dropGroundOn(slot, evt);
    });

    document.addEventListener('click', (evt) => {
      const barLine = evt.target.closest('.inv-skline.toggles');
      if (barLine && inPanels(barLine)) {
        this.toggleBar(barLine.closest('.inv-win').dataset.win, barLine.dataset.bar);
        return;
      }
      const btn = evt.target.closest('.inv-btn, .inv-follow');
      if (!btn || !inPanels(btn)) return;
      const found = this.findWindow(btn.closest('.inv-win').dataset.win);
      if (!found) return;
      if (btn.dataset.act === 'follow') {
        this.game.send({ type: 'toggleFollow' });
        return;
      }
      if (btn.dataset.act === 'send') {
        this.game.send(JSON.parse(btn.dataset.send));
        return;
      }
      if (btn.dataset.act === 'pm') {
        this.game.chatBox.writeTo(btn.dataset.name);
        return;
      }
      if (btn.dataset.act === 'attackmode') {
        this.game.send({ type: 'toggleAttackMode' });
        return;
      }
      if (btn.dataset.act === 'up') {
        const parent = this.parentOf(found.win.uid);
        if (parent) this.showInWindow(found, parent.uid);
        return;
      }
      if (btn.dataset.act === 'min') found.win.min = !found.win.min;
      if (btn.dataset.act === 'close') {
        this.layout[found.col].splice(found.i, 1);
        if (found.win.ground) this.game.send({ type: 'closeContainer', itemId: found.win.ground });
      }
      this.scheduleSave();
      this.lastKey = '';
    });

    const openFromSlot = (evt) => {
      const slot = evt.target.closest && evt.target.closest('.inv-slot.filled');
      if (!slot || !inPanels(slot)) return false;
      const place = this.placeOf(slot);
      const item = this.itemAt(place);
      if (item && !item.items && aimsWith(item.type)) {
        this.startAim(place);
        return true;
      }
      if (item && !item.items && (itemInfo(item.type).food || itemInfo(item.type).light || objectUse(item.type) === 'livro')) {
        this.game.send({ type: 'useItem', from: place });
        return true;
      }
      if (!item || !item.items) return false;
      const origin = this.findWindow(slot.closest('.inv-win').dataset.win);
      if (origin && origin.win.kind === 'container' && !evt.shiftKey) this.showInWindow(origin, item.uid);
      else this.openWindow(item.uid, origin ? origin.win.id : null);
      return true;
    };
    document.addEventListener('dblclick', openFromSlot);
    document.addEventListener('contextmenu', (evt) => {
      if (openFromSlot(evt)) evt.preventDefault();
    });

    // Caixa ou cadáver no chão: duplo clique ou botão direito pede pro
    // servidor abrir (o player vai até o sqm e abre ao chegar; o clique
    // simples só anda até lá).
    const openGround = () => {
      const target = this.openableUnderMouse();
      if (target) {
        this.game.cancelPendingWalk();
        this.game.send({ type: 'openContainer', itemId: target.id });
        return true;
      }
      const usable = this.usableUnderMouse();
      if (!usable) return false;
      this.game.cancelPendingWalk();
      const type = objectIdType(usable.id);
      if (MAP_USES.includes(objectUse(type))) this.game.send({ type: 'useObject', id: usable.id });
      else if (aimsWith(type)) this.startAim({ t: 'g', id: usable.id });
      else this.game.send({ type: 'useItem', from: { t: 'g', id: usable.id } });
      return true;
    };
    this.game.canvas.addEventListener('dblclick', openGround);
    this.game.canvas.addEventListener('contextmenu', (evt) => {
      if (openGround(evt)) evt.preventDefault();
    });
  }
}

Object.assign(InventoryUI.prototype, htmlMethods, windowMethods, aimMethods, dragMethods);
