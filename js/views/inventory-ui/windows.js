// js/views/inventory-ui/windows.js

import { PITCH, SAVE_DELAY_MS, LAYOUT_COLS, LAYOUT_VERSION } from './common.js';

// Métodos do InventoryUI (js/views/inventory-ui.js). As janelas: layout guardado, abrir, fechar, trocar o container
// mostrado, mudar de lugar e de tamanho. Ficam nas colunas da esquerda e da
// direita ou soltas em qualquer lugar da tela (free, com x e y); arrastada
// até a lateral, gruda na coluna.

export const windowMethods = {

  // ================================================================================================================================================================================================================================================
  // initialLayout
  // O layout guardado no personagem (da versão LAYOUT_VERSION) ou, sem ele,
  // vida e mana, skills e battle na esquerda e o inventário na direita; só o
  // inventário e a vida e mana começam abertos.

  initialLayout(view) {
    const layout = { left: [], right: [], free: [] };
    const saved = view.layout;
    if (saved && saved.v === LAYOUT_VERSION && Array.isArray(saved.left) && Array.isArray(saved.right)) {
      for (const col of LAYOUT_COLS) {
        for (const entry of Array.isArray(saved[col]) ? saved[col] : []) {
          if (entry && ['inventory', 'skills', 'vitals', 'battle', 'social'].includes(entry.ref)) {
            layout[col].push(this.makeWindow(entry.ref, null, entry));
            continue;
          }
          const item = entry && typeof entry.path === 'string' ? this.itemAtPath(view, entry.path) : null;
          if (item && item.items) layout[col].push(this.makeWindow('container', item.uid, entry));
        }
      }
      if (LAYOUT_COLS.some(col => layout[col].some(w => w.kind === 'inventory'))) return this.withVitals(layout);
    }
    layout.left.push(this.makeWindow('vitals', null), this.makeWindow('skills', null, { min: true }), this.makeWindow('battle', null, { min: true }), this.makeWindow('social', null, { min: true }));
    layout.right.push(this.makeWindow('inventory', null));
    return layout;
  },

  // ================================================================================================================================================================================================================================================
  // withVitals
  // Vida e mana, skills, battle e social sempre existem (não fecham, só
  // minimizam): a que falta no layout entra embaixo do inventário, nessa
  // ordem. Skills, battle e social entram minimizadas.

  withVitals(layout) {
    let after = 'inventory';
    for (const kind of ['vitals', 'skills', 'battle', 'social']) {
      if (!LAYOUT_COLS.some(c => layout[c].some(w => w.kind === kind))) {
        const col = LAYOUT_COLS.find(c => layout[c].some(w => w.kind === after)) || 'right';
        layout[col].splice(layout[col].findIndex(w => w.kind === after) + 1, 0, this.makeWindow(kind, null, { min: kind !== 'vitals' }));
      }
      after = kind;
    }
    return layout;
  },

  // ================================================================================================================================================================================================================================================
  // makeWindow

  makeWindow(kind, uid, saved = {}) {
    return {
      id: kind === 'container' ? `c-${uid}` : kind,
      kind,
      uid,
      ground: saved.ground || null,
      rows: Number.isInteger(saved.rows) && saved.rows > 0 ? saved.rows : 2,
      min: !!saved.min,
      bars: Array.isArray(saved.bars) ? saved.bars.filter(b => typeof b === 'string') : [],
      x: Number.isFinite(saved.x) ? saved.x : null,
      y: Number.isFinite(saved.y) ? saved.y : null
    };
  },

  // ================================================================================================================================================================================================================================================
  // allWindows

  allWindows() {
    return LAYOUT_COLS.flatMap(col => this.layout[col]);
  },

  // ================================================================================================================================================================================================================================================
  // openBook
  // Janela do livro (título e texto), solta no meio da tela; um livro por vez.

  openBook(title, text) {
    if (!this.layout) return;
    this.removeWindows(w => w.kind === 'book');
    const width = 300;
    this.layout.free.push({ id: 'book', kind: 'book', title, text: text || 'O livro está em branco.', x: Math.max(8, (window.innerWidth - width) / 2), y: Math.max(8, window.innerHeight * 0.18) });
    this.lastKey = '';
    this.render();
  },

  // ================================================================================================================================================================================================================================================
  // syncTradeWindow
  // A janela da troca aparece solta no meio da tela enquanto o servidor diz
  // que há uma troca, e some quando ela acaba.

  syncTradeWindow(view) {
    const trading = !!(view.social && view.social.trade);
    const open = this.allWindows().some(w => w.kind === 'trade');
    if (trading && !open) {
      const width = 260;
      this.layout.free.push({ id: 'trade', kind: 'trade', x: Math.max(8, (window.innerWidth - width) / 2), y: Math.max(8, window.innerHeight * 0.25) });
    } else if (!trading && open) {
      this.removeWindows(w => w.kind === 'trade');
    }
  },

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
  },

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
  },

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
  },

  // ================================================================================================================================================================================================================================================
  // parentOf
  // O container onde está o container uid (null se ele está no inventário ou
  // é a própria caixa do chão).

  parentOf(uid) {
    const search = (item) => {
      if (!item || !item.items) return null;
      for (const child of item.items) {
        if (!child) continue;
        if (child.uid === uid) return item;
        const found = search(child);
        if (found) return found;
      }
      return null;
    };
    for (const root of [...Object.values(this.view.equip), ...this.view.opened.map(o => o.item)]) {
      const found = search(root);
      if (found) return found;
    }
    return null;
  },

  // ================================================================================================================================================================================================================================================
  // showInWindow
  // Troca o container mostrado na janela (abrir um de dentro, ou voltar pro de
  // fora). Se ele já está aberto em outra janela, esta fecha e aquela pisca.

  showInWindow(found, uid) {
    const other = this.allWindows().find(w => w.uid === uid);
    if (other && other !== found.win) {
      this.layout[found.col].splice(found.i, 1);
      other.min = false;
      this.scheduleSave();
      this.render();
      this.flash(other.id);
      return;
    }
    found.win.uid = uid;
    found.win.id = `c-${uid}`;
    found.win.min = false;
    this.scheduleSave();
    this.render();
    this.flash(found.win.id);
  },

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
  },

  // ================================================================================================================================================================================================================================================
  // dropMissingWindows
  // Fecha a janela do container que não está mais ao alcance (jogado no chão…).

  dropMissingWindows() {
    this.removeWindows(w => w.kind === 'container' && !this.findContainer(w.uid));
  },

  // ================================================================================================================================================================================================================================================
  // removeWindows

  removeWindows(match) {
    let changed = false;
    for (const col of LAYOUT_COLS) {
      const kept = this.layout[col].filter(w => !match(w));
      if (kept.length !== this.layout[col].length) changed = true;
      this.layout[col] = kept;
    }
    if (changed) this.scheduleSave();
  },

  // ================================================================================================================================================================================================================================================
  // findWindow

  findWindow(id) {
    for (const col of LAYOUT_COLS) {
      const i = this.layout[col].findIndex(w => w.id === id);
      if (i >= 0) return { col, i, win: this.layout[col][i] };
    }
    return null;
  },

  // ================================================================================================================================================================================================================================================
  // openWindow
  // Abre a janela do container embaixo da janela de origem, se couber na
  // coluna; senão, no fim da outra coluna. Já aberta: só pisca.

  openWindow(uid, besideId = null, groundId = null) {
    const existing = this.allWindows().find(w => w.uid === uid);
    if (existing) {
      existing.min = false;
      this.render();
      this.flash(existing.id);
      return;
    }
    const win = this.makeWindow('container', uid, { ground: groundId });
    const at = besideId ? this.findWindow(besideId) : null;
    const origin = at && at.col !== 'free' ? at.col : 'right';
    const other = origin === 'left' ? 'right' : 'left';
    const index = at ? at.i + 1 : this.layout[origin].length;
    if (this.fitsIn(origin, win)) this.layout[origin].splice(index, 0, win);
    else if (this.fitsIn(other, win)) this.layout[other].push(win);
    else this.layout[origin].splice(index, 0, win);
    this.scheduleSave();
    this.render();
    this.flash(win.id);
  },

  // ================================================================================================================================================================================================================================================
  // fitsIn
  // A janela cabe na coluna sem passar do fim da tela?

  fitsIn(col, win) {
    const el = this.columns[col];
    const used = [...el.querySelectorAll('.inv-win')].reduce((sum, w) => sum + w.offsetHeight + 8, 0);
    const height = win.rows * PITCH + 8 + 30 + 7 + 2;
    return el.getBoundingClientRect().top + 8 + used + height <= window.innerHeight - 8;
  },

  // ================================================================================================================================================================================================================================================
  // flash

  flash(id) {
    const el = document.querySelector(`.inv-win[data-win="${id}"]`);
    if (el) el.classList.add('flash');
  },

  // ================================================================================================================================================================================================================================================
  // scheduleSave
  // Manda o layout pro servidor um pouco depois da última mudança.

  scheduleSave() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      if (!this.view || !this.layout) return;
      const place = (w) => (w.x !== null ? { x: Math.round(w.x), y: Math.round(w.y) } : {});
      const entry = (w) => {
        if (w.kind === 'book' || w.kind === 'trade') return null;
        if (w.kind !== 'container') return { ref: w.kind, rows: w.rows, min: w.min, bars: w.bars, ...place(w) };
        if (w.ground) return null;
        const path = this.pathOf(this.view, w.uid);
        return path ? { path, rows: w.rows, min: w.min, ...place(w) } : null;
      };
      const layout = { v: LAYOUT_VERSION };
      for (const col of LAYOUT_COLS) layout[col] = this.layout[col].map(entry).filter(Boolean);
      this.game.send({ type: 'saveLayout', layout });
    }, SAVE_DELAY_MS);
  },

  // ================================================================================================================================================================================================================================================
  // window drag
  // A janela vai junto com o mouse (uma cópia dela). Perto de uma coluna
  // (lateral da tela), a linha mostra onde ela entra; fora delas, fica solta
  // onde for solta.

  startWinDrag(evt, winId) {
    const el = document.querySelector(`.inv-win[data-win="${winId}"]`);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ghost = /** @type {HTMLElement} */ (el.cloneNode(true));
    ghost.classList.add('inv-ghostwin');
    ghost.style.width = `${rect.width}px`;
    document.body.appendChild(ghost);
    const line = document.createElement('div');
    line.className = 'inv-dropline';
    el.classList.add('dragging');
    this.drag = { kind: 'win', winId, line, ghost, target: null, dx: evt.clientX - rect.left, dy: evt.clientY - rect.top, width: rect.width, height: rect.height };
    this.moveWinDrag(evt);
  },

  moveWinDrag(evt) {
    const { line, ghost } = this.drag;
    const x = Math.max(0, Math.min(window.innerWidth - this.drag.width, evt.clientX - this.drag.dx));
    const y = Math.max(0, Math.min(window.innerHeight - 30, evt.clientY - this.drag.dy));
    ghost.style.left = `${x}px`;
    ghost.style.top = `${y}px`;
    let col = null;
    for (const name of ['left', 'right']) {
      const r = this.columns[name].getBoundingClientRect();
      if (evt.clientX >= r.left - 20 && evt.clientX <= r.right + 20) col = name;
    }
    if (!col) {
      line.remove();
      this.drag.target = { col: 'free', x, y };
      return;
    }
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
  },

  endWinDrag() {
    const { line, ghost, target, winId } = this.drag;
    line.remove();
    ghost.remove();
    this.drag = null;
    const found = this.findWindow(winId);
    if (target && found) {
      this.layout[found.col].splice(found.i, 1);
      if (target.col === 'free') {
        found.win.x = target.x;
        found.win.y = target.y;
        this.layout.free.push(found.win);
      } else {
        found.win.x = found.win.y = null;
        const index = target.col === found.col && target.index > found.i ? target.index - 1 : target.index;
        this.layout[target.col].splice(index, 0, found.win);
      }
      this.scheduleSave();
    }
    this.lastKey = '';
  },
};
