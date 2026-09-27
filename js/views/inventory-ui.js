// js/views/inventory-ui.js

import { getAsset, spriteFrame, splitType, objectIdType } from '../../shared/assets.js';
import { itemInfo, weightOf } from '../../shared/items.js';

// Janelas do inventário e dos containers, nas duas colunas ao lado da tela do
// jogo. Só desenha e manda comandos (moveInv, openContainer, closeContainer,
// saveLayout); quem decide se o movimento vale é o servidor (systems/inventory.js).
// O layout (coluna, ordem, linhas, minimizada) vai pro personagem guardado:
// as janelas são lembradas pelo caminho do container ('mochila/3' = espaço 3
// da mochila), já que os uids mudam a cada vez que o personagem entra.

const EQUIP_LAYOUT = [
  ['amuleto', 'Amuleto'], ['cabeca', 'Cabeça'], ['mochila', 'Mochila'],
  ['arma', 'Mão (arma)'], ['corpo', 'Corpo'], ['escudo', 'Mão (escudo)'],
  ['anel', 'Anel'], ['pernas', 'Pernas'], ['municao', 'Munição'],
  [null], ['pes', 'Pés'], [null]
];
const ICONS = {
  amuleto: '<path d="M6 3c0 6 3 9 6 11 3-2 6-5 6-11"/><circle cx="12" cy="18" r="3"/>',
  cabeca: '<path d="M5 15a7 7 0 0 1 14 0v3H5z"/><path d="M9 18v2m6-2v2"/>',
  mochila: '<rect x="5" y="7" width="14" height="13" rx="2"/><path d="M9 7V5h6v2M5 12h14"/>',
  arma: '<path d="M18 3l3 3-11 11-3-3z"/><path d="M5 16l3 3M4 20l2-2"/>',
  corpo: '<path d="M8 4l4 2 4-2 4 4-3 3v9H7v-9L4 8z"/>',
  escudo: '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/>',
  anel: '<circle cx="12" cy="14" r="6"/><path d="M10 6l2-3 2 3"/>',
  pernas: '<path d="M7 4h10l-1 16h-3l-1-10-1 10H8z"/>',
  municao: '<path d="M4 20L18 6M14 5l5 0 0 5M4 16l4 4"/>',
  pes: '<path d="M6 5h5v9l7 2v4H6z"/>'
};
const PITCH = 40;
const SAVE_DELAY_MS = 600;

export class InventoryUI {

  // ================================================================================================================================================================================================================================================
  // constructor

  constructor(game) {
    this.game = game;
    this.columns = { left: document.getElementById('invLeft'), right: document.getElementById('invRight') };
    this.layout = null;
    this.view = null;
    this.lastKey = '';
    this.openedGround = new Set();
    this.scrollMemory = new Map();
    this.pending = null;
    this.drag = null;
    this.qty = null;
    this.saveTimer = null;
    this.bindEvents();
  }

  // ================================================================================================================================================================================================================================================
  // update
  // A cada quadro: pega o inventário da sessão e redesenha se mudou.

  update() {
    const view = this.game.session && this.game.session.inventoryView;
    if (!view) return;
    this.view = view;
    if (!this.layout) this.layout = this.initialLayout(view);
    this.syncGroundWindows(view);
    this.dropMissingWindows();
    const key = JSON.stringify([view.equip, view.cap, view.opened, this.layout]);
    if (key === this.lastKey || this.drag) return;
    this.lastKey = key;
    this.render();
  }

  // ================================================================================================================================================================================================================================================
  // initialLayout
  // O layout guardado no personagem ou, sem ele, o inventário e a mochila à direita.

  initialLayout(view) {
    const layout = { left: [], right: [] };
    const saved = view.layout;
    if (saved && Array.isArray(saved.left) && Array.isArray(saved.right)) {
      for (const col of ['left', 'right']) {
        for (const entry of saved[col]) {
          if (entry && entry.ref === 'inventory') {
            layout[col].push(this.makeWindow('inventory', null, entry));
            continue;
          }
          const item = entry && typeof entry.path === 'string' ? this.itemAtPath(view, entry.path) : null;
          if (item && item.items) layout[col].push(this.makeWindow('container', item.uid, entry));
        }
      }
      if ([...layout.left, ...layout.right].some(w => w.kind === 'inventory')) return layout;
    }
    layout.right.push(this.makeWindow('inventory', null));
    const bag = view.equip.mochila;
    if (bag && bag.items) layout.right.push(this.makeWindow('container', bag.uid, { rows: 3 }));
    return layout;
  }

  // ================================================================================================================================================================================================================================================
  // makeWindow

  makeWindow(kind, uid, saved = {}) {
    return {
      id: kind === 'inventory' ? 'inventory' : `c-${uid}`,
      kind,
      uid,
      ground: saved.ground || null,
      rows: Number.isInteger(saved.rows) && saved.rows > 0 ? saved.rows : 2,
      min: !!saved.min
    };
  }

  // ================================================================================================================================================================================================================================================
  // itemAtPath / pathOf
  // 'mochila/3/1' ↔ item (espaço 1 do container no espaço 3 da mochila).

  itemAtPath(view, path) {
    const [key, ...indexes] = path.split('/');
    let item = view.equip[key] || null;
    for (const index of indexes) {
      if (!item || !item.items) return null;
      item = item.items[Number(index)] || null;
    }
    return item;
  }

  pathOf(view, uid) {
    const search = (item, path) => {
      if (!item) return null;
      if (item.uid === uid) return path;
      if (!item.items) return null;
      for (let i = 0; i < item.items.length; i++) {
        const found = search(item.items[i], `${path}/${i}`);
        if (found) return found;
      }
      return null;
    };
    for (const [key, item] of Object.entries(view.equip)) {
      const found = search(item, key);
      if (found) return found;
    }
    return null;
  }

  // ================================================================================================================================================================================================================================================
  // findContainer
  // O container uid no que o player carrega ou nas caixas do chão abertas.

  findContainer(uid) {
    const view = this.view;
    const search = (item) => {
      if (!item) return null;
      if (item.uid === uid) return item;
      if (!item.items) return null;
      for (const child of item.items) {
        const found = search(child);
        if (found) return found;
      }
      return null;
    };
    for (const item of Object.values(view.equip)) {
      const found = search(item);
      if (found) return found;
    }
    for (const opened of view.opened) {
      const found = search(opened.item);
      if (found) return found;
    }
    return null;
  }

  // ================================================================================================================================================================================================================================================
  // isOpen

  isOpen(uid) {
    return [...this.layout.left, ...this.layout.right].some(w => w.uid === uid);
  }

  // ================================================================================================================================================================================================================================================
  // syncGroundWindows
  // Caixa do chão que o servidor abriu ganha janela; a que ele fechou (player
  // se afastou) perde.

  syncGroundWindows(view) {
    const now = new Set(view.opened.map(o => o.id));
    for (const opened of view.opened) {
      if (this.openedGround.has(opened.id)) continue;
      this.openWindow(opened.item.uid, null, opened.id);
    }
    for (const id of this.openedGround) {
      if (!now.has(id)) this.removeWindows(w => w.ground === id);
    }
    this.openedGround = now;
  }

  // ================================================================================================================================================================================================================================================
  // dropMissingWindows
  // Fecha a janela do container que não está mais ao alcance (jogado no chão…).

  dropMissingWindows() {
    this.removeWindows(w => w.kind === 'container' && !this.findContainer(w.uid));
  }

  // ================================================================================================================================================================================================================================================
  // removeWindows

  removeWindows(match) {
    let changed = false;
    for (const col of ['left', 'right']) {
      const kept = this.layout[col].filter(w => !match(w));
      if (kept.length !== this.layout[col].length) changed = true;
      this.layout[col] = kept;
    }
    if (changed) this.scheduleSave();
  }

  // ================================================================================================================================================================================================================================================
  // findWindow

  findWindow(id) {
    for (const col of ['left', 'right']) {
      const i = this.layout[col].findIndex(w => w.id === id);
      if (i >= 0) return { col, i, win: this.layout[col][i] };
    }
    return null;
  }

  // ================================================================================================================================================================================================================================================
  // openWindow
  // Abre a janela do container embaixo da janela de origem, se couber na
  // coluna; senão, no fim da outra coluna. Já aberta: só pisca.

  openWindow(uid, besideId = null, groundId = null) {
    const existing = [...this.layout.left, ...this.layout.right].find(w => w.uid === uid);
    if (existing) {
      existing.min = false;
      this.render();
      this.flash(existing.id);
      return;
    }
    const win = this.makeWindow('container', uid, { ground: groundId });
    const at = besideId ? this.findWindow(besideId) : null;
    const origin = at ? at.col : 'right';
    const other = origin === 'left' ? 'right' : 'left';
    const index = at ? at.i + 1 : this.layout[origin].length;
    if (this.fitsIn(origin, win)) this.layout[origin].splice(index, 0, win);
    else if (this.fitsIn(other, win)) this.layout[other].push(win);
    else this.layout[origin].splice(index, 0, win);
    this.scheduleSave();
    this.render();
    this.flash(win.id);
  }

  // ================================================================================================================================================================================================================================================
  // fitsIn
  // A janela cabe na coluna sem passar do fim da tela?

  fitsIn(col, win) {
    const el = this.columns[col];
    const used = [...el.querySelectorAll('.inv-win')].reduce((sum, w) => sum + w.offsetHeight + 8, 0);
    const height = win.rows * PITCH + 8 + 30 + 7 + 2;
    return el.getBoundingClientRect().top + 8 + used + height <= window.innerHeight - 8;
  }

  // ================================================================================================================================================================================================================================================
  // flash

  flash(id) {
    const el = document.querySelector(`.inv-win[data-win="${id}"]`);
    if (el) el.classList.add('flash');
  }

  // ================================================================================================================================================================================================================================================
  // scheduleSave
  // Manda o layout pro servidor um pouco depois da última mudança.

  scheduleSave() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      if (!this.view || !this.layout) return;
      const entry = (w) => {
        if (w.kind === 'inventory') return { ref: 'inventory', rows: w.rows, min: w.min };
        if (w.ground) return null;
        const path = this.pathOf(this.view, w.uid);
        return path ? { path, rows: w.rows, min: w.min } : null;
      };
      const layout = {
        left: this.layout.left.map(entry).filter(Boolean),
        right: this.layout.right.map(entry).filter(Boolean)
      };
      this.game.send({ type: 'saveLayout', layout });
    }, SAVE_DELAY_MS);
  }

  // ================================================================================================================================================================================================================================================
  // spriteHtml
  // O 1º quadro do item em 32 px (recortado da folha do gerador).

  spriteHtml(type) {
    const frame = spriteFrame(type);
    const asset = getAsset(splitType(type).asset);
    if (!frame || !asset) return '<i class="inv-spr missing"></i>';
    const scale = 32 / frame.size;
    const width = Math.max(1, asset.quadros || 1) * asset.quadro * scale;
    const height = asset.quadro * scale;
    return `<i class="inv-spr" style="background-image:url(${frame.url});background-size:${width}px ${height}px;background-position:${-frame.x * scale}px ${-frame.y * scale}px"></i>`;
  }

  // ================================================================================================================================================================================================================================================
  // slotHtml

  slotHtml(item, place, hintKey = null) {
    const key = place.t === 'e' ? `e:${place.key}` : `c:${place.uid}:${place.i}`;
    if (!item) {
      const icon = hintKey ? `<svg class="inv-hint" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">${ICONS[hintKey]}</svg>` : '';
      return `<div class="inv-slot" data-place="${key}">${icon}</div>`;
    }
    const info = itemInfo(item.type);
    const count = item.count > 1 ? `<span class="inv-count">${item.count}</span>` : '';
    const open = item.items && this.isOpen(item.uid) ? '<span class="inv-open"></span>' : '';
    const title = `${info.name}${item.count > 1 ? ` (${item.count})` : ''} · ${weightOf(item)} oz${item.items ? ' · duplo clique abre' : ''}`;
    return `<div class="inv-slot filled" data-place="${key}" data-uid="${item.uid}" title="${title}">${this.spriteHtml(item.type)}${count}${open}</div>`;
  }

  // ================================================================================================================================================================================================================================================
  // windowHtml

  windowHtml(win) {
    const buttons = (closable) => `<button class="inv-btn" data-act="min" type="button" aria-label="Minimizar">${win.min ? '+' : '–'}</button>` +
      (closable ? '<button class="inv-btn close" data-act="close" type="button" aria-label="Fechar">×</button>' : '');
    if (win.kind === 'inventory') {
      const { equip, cap } = this.view;
      const free = Math.max(0, cap.max - cap.used);
      const capBox = `<div class="inv-capbox${free < cap.max * 0.15 ? ' heavy' : ''}" title="Cap livre: ${Math.round(free * 10) / 10} oz">${Math.floor(free)}</div>`;
      const spare = '<div class="inv-capbox"></div>';
      const last = EQUIP_LAYOUT.length - 1;
      const cell = ([key], i) => key ? this.slotHtml(equip[key], { t: 'e', key }, key) : (i === last ? capBox : (i === last - 2 ? spare : ''));
      const cells = [0, 1, 2].map(col => `<div class="inv-dollcol">${EQUIP_LAYOUT.map((entry, i) => i % 3 === col ? cell(entry, i) : '').join('')}</div>`).join('');
      return `<section class="inv-win${win.min ? ' min' : ''}" data-win="${win.id}">
        <header class="inv-head"><span class="inv-title">Inventário</span>${buttons(false)}</header>
        <div class="inv-body"><div class="inv-doll">${cells}</div></div>
      </section>`;
    }
    const box = this.findContainer(win.uid);
    if (!box) return '';
    const used = box.items.filter(Boolean).length;
    const slots = box.items.map((item, i) => this.slotHtml(item, { t: 'c', uid: box.uid, i })).join('');
    return `<section class="inv-win${win.min ? ' min' : ''}" data-win="${win.id}">
      <header class="inv-head"><span class="inv-icon">${this.spriteHtml(box.type)}</span>
        <span class="inv-title">${this.windowTitle(win, box)}</span>
        <span class="inv-cap${used === box.items.length ? ' full' : ''}">${used}/${box.items.length}</span>${buttons(true)}</header>
      <div class="inv-body"><div class="inv-scroller" style="height:${Math.min(win.rows, Math.ceil(box.items.length / 4)) * PITCH + 8}px"><div class="inv-grid">${slots}</div></div></div>
      <div class="inv-resize" title="Arraste pra mostrar mais ou menos linhas"></div>
    </section>`;
  }

  // ================================================================================================================================================================================================================================================
  // windowTitle
  // Nome do container; do chão, com (chão); cadáver, com (morto).

  windowTitle(win, box) {
    const name = itemInfo(box.type).name;
    if (!win.ground) return name;
    const opened = this.view.opened.find(o => o.id === win.ground);
    return `${name} <em>${opened && opened.corpse ? '(morto)' : '(chão)'}</em>`;
  }

  // ================================================================================================================================================================================================================================================
  // render

  render() {
    if (!this.view || !this.layout) return;
    document.querySelectorAll('.inv-scroller').forEach(sc => this.scrollMemory.set(sc.closest('.inv-win').dataset.win, sc.scrollTop));
    for (const col of ['left', 'right']) this.columns[col].innerHTML = this.layout[col].map(w => this.windowHtml(w)).join('');
    document.querySelectorAll('.inv-scroller').forEach(sc => {
      sc.scrollTop = this.scrollMemory.get(sc.closest('.inv-win').dataset.win) || 0;
      this.updateFade(sc);
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
  // placeOf
  // data-place do espaço → lugar do comando.

  placeOf(el) {
    const [t, a, b] = el.dataset.place.split(':');
    return t === 'e' ? { t, key: a } : { t, uid: a, i: Number(b) };
  }

  // ================================================================================================================================================================================================================================================
  // itemAt

  itemAt(place) {
    if (place.t === 'e') return this.view.equip[place.key];
    const box = this.findContainer(place.uid);
    return box ? box.items[place.i] : null;
  }

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
  }

  // ================================================================================================================================================================================================================================================
  // sendMove
  // Manda o movimento; com Shift numa pilha, pergunta a quantidade antes.

  sendMove(from, to, count, evt) {
    const send = (amount) => this.game.send({ type: 'moveInv', from, to, amount });
    if (evt.shiftKey && count > 1) this.askAmount(count, evt, send);
    else send(count || 1);
  }

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
  }

  closeQty() {
    if (this.qty) this.qty.remove();
    this.qty = null;
  }

  // ================================================================================================================================================================================================================================================
  // startItemDrag

  startItemDrag(evt, from, item, sourceEl) {
    const ghost = document.createElement('div');
    ghost.className = 'inv-ghost';
    ghost.innerHTML = this.spriteHtml(item.type) + (item.count > 1 ? `<span class="inv-count">${item.count}</span>` : '');
    document.body.appendChild(ghost);
    sourceEl.classList.add('source');
    const slot = itemInfo(item.type).slot;
    document.querySelectorAll('.inv-slot').forEach(el => {
      if (el === sourceEl) return;
      const place = this.placeOf(el);
      if (place.t === 'c' || place.key === slot) el.classList.add('can-drop');
    });
    this.drag = { kind: 'item', from, item, ghost, sourceEl };
    this.moveGhost(evt);
  }

  moveGhost(evt) {
    this.drag.ghost.style.left = `${evt.clientX + 6}px`;
    this.drag.ghost.style.top = `${evt.clientY + 6}px`;
    document.querySelectorAll('.inv-slot.over').forEach(el => el.classList.remove('over'));
    const slot = document.elementFromPoint(evt.clientX, evt.clientY)?.closest('.inv-slot');
    if (slot && slot !== this.drag.sourceEl) slot.classList.add('over');
  }

  endItemDrag(evt) {
    const { from, item, ghost } = this.drag;
    ghost.remove();
    document.querySelectorAll('.inv-slot').forEach(el => el.classList.remove('can-drop', 'over', 'source'));
    this.drag = null;
    const target = document.elementFromPoint(evt.clientX, evt.clientY);
    const slot = target && target.closest('.inv-slot');
    const to = slot ? this.placeOf(slot) : this.worldDrop({ target, clientX: evt.clientX, clientY: evt.clientY });
    if (to) this.sendMove(from, to, item.count || 1, evt);
    this.lastKey = '';
  }

  // ================================================================================================================================================================================================================================================
  // window drag / resize

  startWinDrag(evt, winId) {
    const line = document.createElement('div');
    line.className = 'inv-dropline';
    document.querySelector(`.inv-win[data-win="${winId}"]`)?.classList.add('dragging');
    this.drag = { kind: 'win', winId, line, target: null };
    this.moveWinDrag(evt);
  }

  moveWinDrag(evt) {
    const { line } = this.drag;
    let col = null;
    for (const [name, el] of Object.entries(this.columns)) {
      const r = el.getBoundingClientRect();
      if (evt.clientX >= r.left - 20 && evt.clientX <= r.right + 20) col = name;
    }
    if (!col) { line.remove(); this.drag.target = null; return; }
    const colEl = this.columns[col];
    const wins = [...colEl.querySelectorAll('.inv-win')];
    let index = wins.length;
    for (let i = 0; i < wins.length; i++) {
      const r = wins[i].getBoundingClientRect();
      if (evt.clientY < r.top + r.height / 2) { index = i; break; }
    }
    if (index < wins.length) colEl.insertBefore(line, wins[index]);
    else colEl.appendChild(line);
    this.drag.target = { col, index };
  }

  endWinDrag() {
    const { line, target, winId } = this.drag;
    line.remove();
    this.drag = null;
    const found = this.findWindow(winId);
    if (target && found) {
      this.layout[found.col].splice(found.i, 1);
      const index = target.col === found.col && target.index > found.i ? target.index - 1 : target.index;
      this.layout[target.col].splice(index, 0, found.win);
      this.scheduleSave();
    }
    this.lastKey = '';
  }

  // ================================================================================================================================================================================================================================================
  // bindEvents

  bindEvents() {
    const panels = Object.values(this.columns);
    const inPanels = (el) => panels.some(p => p.contains(el));

    document.addEventListener('pointerdown', (evt) => {
      if (this.qty && !evt.target.closest('.inv-qty')) this.closeQty();
      if (evt.button !== 0 || !inPanels(evt.target) || evt.target.closest('.inv-btn')) return;
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
      this.pending = null;
      if (!this.drag) return;
      if (this.drag.kind === 'item') this.endItemDrag(evt);
      else if (this.drag.kind === 'win') this.endWinDrag();
      else { this.drag = null; this.scheduleSave(); this.lastKey = ''; }
    });

    // Item arrastado da tela do jogo e solto numa janela (a tela não recebe o mouseup).
    document.addEventListener('mouseup', (evt) => {
      const input = this.game.inputController;
      if (!input || !input.draggingCandidate || !input.dragOccurred) return;
      const slot = evt.target.closest && evt.target.closest('.inv-slot');
      const obj = input.draggingCandidate;
      input.draggingCandidate = null;
      input.dragOccurred = false;
      input.dragStartMouse = null;
      if (!slot || obj.isCorpse) return;
      this.sendMove({ t: 'g', id: obj.id }, this.placeOf(slot), obj.count || 1, evt);
    });

    document.addEventListener('click', (evt) => {
      const btn = evt.target.closest('.inv-btn');
      if (!btn || !inPanels(btn)) return;
      const found = this.findWindow(btn.closest('.inv-win').dataset.win);
      if (!found) return;
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
      const item = this.itemAt(this.placeOf(slot));
      if (!item || !item.items) return false;
      this.openWindow(item.uid, slot.closest('.inv-win').dataset.win);
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
      const input = this.game.inputController;
      const corpse = input && input.hoverCorpse;
      if (corpse && !corpse.isPlayer) {
        this.game.send({ type: 'openContainer', itemId: corpse.id });
        return true;
      }
      const obj = input && input.hoverObject;
      if (!obj || obj.movable !== true || !itemInfo(objectIdType(obj.id)).size) return false;
      this.game.send({ type: 'openContainer', itemId: obj.id });
      return true;
    };
    this.game.canvas.addEventListener('dblclick', openGround);
    this.game.canvas.addEventListener('contextmenu', (evt) => {
      if (openGround(evt)) evt.preventDefault();
    });
  }
}
