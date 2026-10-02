// js/views/inventory-ui/windows.js

import { PITCH, SAVE_DELAY_MS } from './common.js';

// Métodos do InventoryUI (js/views/inventory-ui.js). As janelas: layout guardado, abrir, fechar, trocar o container
// mostrado, mudar de lugar e de tamanho.

export const windowMethods = {

  // ================================================================================================================================================================================================================================================
  // initialLayout
  // O layout guardado no personagem ou, sem ele, o inventário à direita (a
  // mochila começa fechada).

  initialLayout(view) {
    const layout = { left: [], right: [] };
    const saved = view.layout;
    if (saved && Array.isArray(saved.left) && Array.isArray(saved.right)) {
      for (const col of ['left', 'right']) {
        for (const entry of saved[col]) {
          if (entry && ['inventory', 'skills', 'vitals', 'battle'].includes(entry.ref)) {
            layout[col].push(this.makeWindow(entry.ref, null, entry));
            continue;
          }
          const item = entry && typeof entry.path === 'string' ? this.itemAtPath(view, entry.path) : null;
          if (item && item.items) layout[col].push(this.makeWindow('container', item.uid, entry));
        }
      }
      if ([...layout.left, ...layout.right].some(w => w.kind === 'inventory')) return this.withVitals(layout);
    }
    layout.right.push(this.makeWindow('inventory', null));
    return this.withVitals(layout);
  },

  // ================================================================================================================================================================================================================================================
  // withVitals
  // Vida e mana, skills e battle sempre existem (não fecham, só minimizam):
  // a que falta no layout entra embaixo do inventário, nessa ordem. Skills e
  // battle entram minimizadas.

  withVitals(layout) {
    let after = 'inventory';
    for (const kind of ['vitals', 'skills', 'battle']) {
      if (![...layout.left, ...layout.right].some(w => w.kind === kind)) {
        const col = ['left', 'right'].find(c => layout[c].some(w => w.kind === after)) || 'right';
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
      bars: Array.isArray(saved.bars) ? saved.bars.filter(b => typeof b === 'string') : []
    };
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
    const other = [...this.layout.left, ...this.layout.right].find(w => w.uid === uid);
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
    for (const col of ['left', 'right']) {
      const kept = this.layout[col].filter(w => !match(w));
      if (kept.length !== this.layout[col].length) changed = true;
      this.layout[col] = kept;
    }
    if (changed) this.scheduleSave();
  },

  // ================================================================================================================================================================================================================================================
  // findWindow

  findWindow(id) {
    for (const col of ['left', 'right']) {
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
      const entry = (w) => {
        if (w.kind !== 'container') return { ref: w.kind, rows: w.rows, min: w.min, bars: w.bars };
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
  },

  // ================================================================================================================================================================================================================================================
  // window drag / resize

  startWinDrag(evt, winId) {
    const line = document.createElement('div');
    line.className = 'inv-dropline';
    document.querySelector(`.inv-win[data-win="${winId}"]`)?.classList.add('dragging');
    this.drag = { kind: 'win', winId, line, target: null };
    this.moveWinDrag(evt);
  },

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
  },

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
  },
};
