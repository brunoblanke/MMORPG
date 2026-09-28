// js/views/inventory-ui.js

import { getAsset, spriteFrame, splitType, objectIdType, displayName } from '../../shared/assets.js';
import { getLevel } from '../core/geometry.js';
import { itemInfo, weightOf } from '../../shared/items.js';
import { SKILL_KEYS } from '../../shared/skills.js';
import { PLAYER_SPRITES, DEFAULT_GENDER } from '../../shared/catalog.js';
import { CORPSE_ROW } from './sprite-registry.js';

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
const MODE_ICONS = {
  follow: '<svg viewBox="0 0 161.65 181.2" fill="currentColor"><path d="M122.52,42.51c10.97,5.99,24.72,1.94,30.71-9.03,5.99-10.97,1.94-24.72-9.03-30.71-10.97-5.99-24.72-1.94-30.71,9.03-5.99,10.97-1.94,24.72,9.03,30.71Z"/><path d="M69,128.3l-12.08,12.56c-2,2.1-4.66,3.32-7.49,3.64-.4,0-.81.08-1.21.08l-36.28-.24C5.31,144.34-.08,138.92,0,132.31c0-6.71,5.39-12.02,12.02-12.02l31.13.16,8.36-8.68c2.05,3.59,4.82,6.82,8.27,9.46l9.22,7.06Z"/><path d="M161.63,89.64c-.24,5.25-4.35,9.44-9.52,9.92-.48.08-1.05.08-1.61.08l-21.94-1.21c-4.03-.24-7.58-2.75-9.19-6.46l-5.24-12.34-22.99,25.08,23.15,17.75c2.82,2.18,4.6,5.48,4.76,9.03l1.53,37.18c.24,6.37-4.52,11.85-10.89,12.42-.16,0-.4.08-.64.08-6.61.24-12.26-4.92-12.5-11.54l-1.37-31.53-30.48-23.31c-8.99-6.88-11.74-19.27-6.43-29.27.84-1.58,1.63-2.96,2.31-3.97,6.85-10.08,15.32-21.94,22.18-30l-9.6-3.71-17.75,9.03c-5.16,2.66-11.53.56-14.2-4.68-2.66-5.16-.57-11.54,4.68-14.2l21.86-11.13c2.66-1.29,5.81-1.45,8.63-.41l26.86,10.33c2.42.97,4.68,2.26,6.69,3.87l10.97,8.71c3.31,2.58,5.89,6.05,7.58,9.92l7.74,18.39,15.49.81c5.81.32,10.24,5.32,9.92,11.13Z"/></svg>',
  stand: '<svg viewBox="0 0 108.92 191.98" fill="currentColor"><path d="M54.46,41.18c11.37,0,20.59-9.22,20.59-20.59S65.83,0,54.46,0s-20.59,9.22-20.59,20.59,9.22,20.59,20.59,20.59Z"/><path d="M107.36,71.45c-.68-1.01-17.06-24.91-52.9-24.91S2.24,70.43,1.56,71.45c-2.14,3.21-2.08,7.4.16,10.53l16.22,22.72c1.81,2.53,4.65,3.88,7.55,3.88,1.86,0,3.74-.56,5.37-1.73.5-.35.94-.76,1.35-1.18l-.05,6.45-5.72,68.71c-.48,5.66,3.74,10.64,9.4,11.11.29.03.58.04.87.04,5.3,0,9.8-4.06,10.25-9.43l5.5-66.08h4.01l5.5,66.08c.47,5.66,5.48,9.9,11.11,9.4,5.66-.47,9.87-5.45,9.4-11.11l-5.72-68.71-.04-6.45c.4.43.85.83,1.35,1.18,1.63,1.16,3.51,1.73,5.37,1.73,2.9,0,5.74-1.35,7.55-3.88l16.22-22.72c2.24-3.14,2.3-7.32.16-10.53ZM32.3,92.93l-11.21-15.71c2.54-2.33,6.33-5.14,11.37-7.49l-.16,23.19ZM76.62,92.93l-.16-23.22c5.06,2.35,8.85,5.17,11.39,7.5l-11.22,15.72Z"/></svg>',
  attack: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="m13 19 6-6"/><path d="m16 16 4 4"/><path d="m19 21 2-2"/><path d="M14.5 6.5 18 3h3v3l-3.5 3.5"/><path d="m5 14 4 4"/><path d="m7 17-3 3"/><path d="m3 19 2 2"/></svg>',
  defense: '<svg viewBox="0 0 24 24" fill="currentColor" fill-opacity=".35" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>'
};
const SKILL_NAMES = {
  magic: 'ML', fist: 'Fist', club: 'Club', sword: 'Sword', axe: 'Axe',
  distance: 'Distance', shielding: 'Shielding', fishing: 'Fishing'
};
const PITCH = 40;
const LAYOUT_VERSION = 2;
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
    this.dropMissingWindows();
    const player = this.game.player;
    this.battle = this.findWindow('battle') ? this.battleList() : [];
    const modes = player ? [player.followMode, player.attackMode] : null;
    const key = JSON.stringify([view.equip, view.cap, view.opened, view.stats, this.layout, modes, this.battle]);
    if (key === this.lastKey || this.drag) return;
    this.lastKey = key;
    this.render();
  }

  // ================================================================================================================================================================================================================================================
  // openableUnderMouse
  // Caixa ou cadáver sob o mouse na tela do jogo (o que o duplo clique abre).

  openableUnderMouse() {
    const input = this.game.inputController;
    if (!input) return null;
    if (input.hoverCorpse) return input.hoverCorpse;
    const obj = input.hoverObject;
    if (!obj || obj.movable !== true || !itemInfo(objectIdType(obj.id)).size) return null;
    return obj;
  }

  // ================================================================================================================================================================================================================================================
  // updateGroundGhost
  // Item arrastado da tela do jogo: o desenho dele segue o mouse, no canto
  // inferior direito, como o das janelas.

  updateGroundGhost() {
    const input = this.game.inputController;
    const obj = input && input.dragOccurred ? input.draggingCandidate : null;
    if (!obj) {
      if (this.groundGhost) {
        this.groundGhost.remove();
        this.markSlot(null);
      }
      this.groundGhost = null;
      return;
    }
    const slot = document.elementFromPoint(this.mouse.x, this.mouse.y)?.closest('.inv-slot');
    this.markSlot(slot || null, (place) => !obj.isCorpse && this.canDropOn(objectIdType(obj.id), null, place));
    if (!this.groundGhost) {
      this.groundGhost = document.createElement('div');
      this.groundGhost.className = 'inv-ghost';
      this.groundGhost.innerHTML = obj.isCorpse ? this.corpseSpriteHtml(obj) : this.spriteHtml(objectIdType(obj.id)) + (obj.count > 1 ? `<span class="inv-count">${obj.count}</span>` : '');
      document.body.appendChild(this.groundGhost);
    }
    this.groundGhost.style.left = `${this.mouse.x + 6}px`;
    this.groundGhost.style.top = `${this.mouse.y + 6}px`;
  }

  // ================================================================================================================================================================================================================================================
  // initialLayout
  // O layout guardado no personagem ou, sem ele, o inventário e a mochila à
  // direita e a battle à esquerda. Layout guardado antes da battle existir
  // (sem v) ganha a battle uma vez; depois, fechada, fica fechada.

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
      if ([...layout.left, ...layout.right].some(w => w.kind === 'inventory')) {
        if (saved.v !== LAYOUT_VERSION && !layout.left.some(w => w.kind === 'battle')) layout.left.unshift(this.makeWindow('battle', null));
        return this.withVitals(layout);
      }
    }
    layout.right.push(this.makeWindow('inventory', null));
    const bag = view.equip.mochila;
    if (bag && bag.items) layout.right.push(this.makeWindow('container', bag.uid, { rows: 3 }));
    layout.left.push(this.makeWindow('battle', null));
    return this.withVitals(layout);
  }

  // ================================================================================================================================================================================================================================================
  // withVitals
  // A janela de vida e mana sempre existe: sem ela no layout, entra logo
  // embaixo do inventário.

  withVitals(layout) {
    if ([...layout.left, ...layout.right].some(w => w.kind === 'vitals')) return layout;
    for (const col of ['left', 'right']) {
      const i = layout[col].findIndex(w => w.kind === 'inventory');
      if (i >= 0) {
        layout[col].splice(i + 1, 0, this.makeWindow('vitals', null));
        return layout;
      }
    }
    layout.right.unshift(this.makeWindow('vitals', null));
    return layout;
  }

  // ================================================================================================================================================================================================================================================
  // makeWindow

  makeWindow(kind, uid, saved = {}) {
    return {
      id: kind === 'container' ? `c-${uid}` : kind,
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
  }

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
        if (w.kind !== 'container') return { ref: w.kind, rows: w.rows, min: w.min };
        if (w.ground) return null;
        const path = this.pathOf(this.view, w.uid);
        return path ? { path, rows: w.rows, min: w.min } : null;
      };
      const layout = {
        v: LAYOUT_VERSION,
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
  // corpseSpriteHtml
  // O 1º quadro do cadáver (5ª linha da folha da criatura) em 32 px.

  corpseSpriteHtml(corpse) {
    const creature = corpse.isPlayer ? PLAYER_SPRITES[DEFAULT_GENDER] : corpse.creature;
    const asset = getAsset(creature);
    if (!asset || !asset.cadaver) return '<i class="inv-spr missing"></i>';
    const scale = 32 / asset.quadro;
    const width = Math.max(1, asset.quadros || 1) * asset.quadro * scale;
    const height = (CORPSE_ROW + 1) * asset.quadro * scale;
    return `<i class="inv-spr" style="background-image:url(${asset.url});background-size:${width}px ${height}px;background-position:0 ${-CORPSE_ROW * asset.quadro * scale}px"></i>`;
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
    const attrs = [info.atk && `Atk ${info.atk}`, info.def && `Def ${info.def}`, info.ml && `ML ${info.ml}`, info.speed && `Speed +${info.speed}`].filter(Boolean).join(' · ');
    const title = `${info.name}${item.count > 1 ? ` (${item.count})` : ''}${attrs ? ` · ${attrs}` : ''} · ${weightOf(item)} oz${item.items ? ' · duplo clique abre' : ''}`;
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
      const cells = [0, 1, 2].map(col => `<div class="inv-dollcol">${col === 0 ? this.modesHtml() : ''}${EQUIP_LAYOUT.map((entry, i) => i % 3 === col ? cell(entry, i) : '').join('')}</div>`).join('');
      return `<section class="inv-win${win.min ? ' min' : ''}" data-win="${win.id}">
        <header class="inv-head tight"><span class="inv-title">Inventário</span>
          <button class="inv-btn wide${this.findWindow('battle') ? ' on' : ''}" data-act="battle" type="button" aria-label="Abrir battle">Battle</button><button class="inv-btn wide${this.findWindow('skills') ? ' on' : ''}" data-act="skills" type="button" aria-label="Abrir skills">Skills</button>${buttons(false)}</header>
        <div class="inv-body"><div class="inv-doll">${cells}</div></div>
      </section>`;
    }
    if (win.kind === 'skills') return this.skillsHtml(win, buttons(true));
    if (win.kind === 'battle') return this.battleHtml(win, buttons(true));
    if (win.kind === 'vitals') return this.vitalsHtml(win);
    const box = this.findContainer(win.uid);
    if (!box) return '';
    const used = box.items.filter(Boolean).length;
    const slots = box.items.map((item, i) => this.slotHtml(item, { t: 'c', uid: box.uid, i })).join('');
    const up = this.parentOf(win.uid) ? '<button class="inv-btn" data-act="up" type="button" aria-label="Voltar pro container de fora" title="Voltar pro container de fora">↑</button>' : '';
    return `<section class="inv-win${win.min ? ' min' : ''}" data-win="${win.id}">
      <header class="inv-head"><span class="inv-icon">${this.spriteHtml(box.type)}</span>
        <span class="inv-title">${this.windowTitle(win, box)}</span>
        <span class="inv-cap${used === box.items.length ? ' full' : ''}">${used}/${box.items.length}</span>${up}${buttons(true)}</header>
      <div class="inv-body"><div class="inv-scroller" style="height:${Math.min(win.rows, Math.ceil(box.items.length / 4)) * PITCH + 8}px"><div class="inv-grid">${slots}</div></div></div>
      <div class="inv-resize" title="Arraste pra mostrar mais ou menos linhas"></div>
    </section>`;
  }

  // ================================================================================================================================================================================================================================================
  // windowTitle
  // Nome do container; do chão, com (chão); cadáver, com (morto).

  windowTitle(win, box) {
    if (!win.ground) return itemInfo(box.type).name;
    const opened = this.view.opened.find(o => o.id === win.ground);
    const corpse = opened && opened.corpse;
    const name = corpse && opened.name && opened.item.uid === box.uid ? opened.name : itemInfo(box.type).name;
    return `${name} <em>${corpse ? '(morto)' : '(chão)'}</em>`;
  }

  // ================================================================================================================================================================================================================================================
  // skillsHtml
  // Janela de skills no formato do Tibia 7.6, com nomes curtos (a cap fica
  // só no inventário).

  skillsHtml(win, buttons) {
    const stats = this.view.stats;
    if (!stats) return '';
    const fmt = (n) => Number(n).toLocaleString('pt-BR');
    const line = (label, value, pct) => `<div class="inv-skrow"><span>${label}</span><b>${value}</b></div>` +
      (pct === undefined ? '' : `<div class="inv-skbar" title="${pct}% até o próximo"><i style="width:${pct}%"></i></div>`);
    const skill = (key) => {
      const entry = stats.skills[key];
      const value = entry.bonus ? `${entry.lvl} <em class="inv-skbonus">+ ${entry.bonus}</em>` : entry.lvl;
      return line(SKILL_NAMES[key], value, entry.pct);
    };
    const body = [
      line('XP', fmt(stats.experience)),
      line('LVL', stats.level, stats.levelPct),
      '<div class="inv-sksep"></div>',
      line('HP', fmt(stats.hp)),
      line('MP', fmt(stats.mana)),
      '<div class="inv-sksep"></div>',
      ...['magic', ...SKILL_KEYS].map(skill)
    ].join('');
    return `<section class="inv-win${win.min ? ' min' : ''}" data-win="${win.id}">
      <header class="inv-head"><span class="inv-title">Skills</span>${buttons}</header>
      <div class="inv-body"><div class="inv-skills">${body}</div></div>
    </section>`;
  }

  // ================================================================================================================================================================================================================================================
  // vitalsHtml
  // Barras de vida e mana, só o desenho (sem números). A janela toda é a alça:
  // dá pra arrastar, mas não minimizar nem fechar.

  vitalsHtml(win) {
    const stats = this.view.stats;
    if (!stats) return '';
    const pct = (value, max) => (max > 0 ? Math.max(0, Math.min(100, value / max * 100)) : 0);
    return `<section class="inv-win" data-win="${win.id}">
      <header class="inv-head inv-vitals" aria-label="Vida e mana">
        <div class="inv-vbar hp"><i style="width:${pct(stats.hp, stats.maxHp)}%"></i></div>
        <div class="inv-vbar mana"><i style="width:${pct(stats.mana, stats.maxMana)}%"></i></div>
      </header>
    </section>`;
  }

  // ================================================================================================================================================================================================================================================
  // modesHtml
  // Os dois modos, no canto do inventário: seguir o alvo (pegadas) ou ficar
  // parado (boneco); auto ataque (espadas vermelhas) ou defesa (escudo verde).

  modesHtml() {
    const player = this.game.player;
    if (!player) return '';
    const follow = player.followMode !== false;
    const attack = !!player.attackMode;
    return `<div class="inv-modes">
      <button class="inv-btn inv-mode${follow ? ' on' : ''}" data-act="follow" type="button" title="${follow ? 'Seguindo o alvo (clique pra ficar parado)' : 'Parado (clique pra seguir o alvo)'}">${MODE_ICONS[follow ? 'follow' : 'stand']}</button>
      <button class="inv-btn inv-mode ${attack ? 'attack' : 'defense'}" data-act="attackmode" type="button" title="${attack ? 'Auto ataque: ataca quem se aproximar (clique pra defesa)' : 'Defesa: só ataca o alvo escolhido (clique pra auto ataque)'}">${MODE_ICONS[attack ? 'attack' : 'defense']}</button>
    </div>`;
  }

  // ================================================================================================================================================================================================================================================
  // battleList
  // Inimigos vivos que aparecem na tela, no andar do player: nome, vida e se
  // é o alvo.

  battleList() {
    const { player, session, camera } = this.game;
    if (!player || !session || !camera) return [];
    const visible = camera.getVisibleTiles();
    const level = getLevel(player);
    const targetId = player.target ? player.target.id : null;
    return session.enemies
      .filter(e => e.isAlive() && getLevel(e) === level &&
        e.x >= visible.startX && e.x < visible.endX && e.y >= visible.startY && e.y < visible.endY)
      .map(e => ({ id: e.id, name: displayName(e.creature), hp: Math.max(0, Math.round(e.currentHp / e.maxHp * 100)), target: e.id === targetId }));
  }

  // ================================================================================================================================================================================================================================================
  // battleHtml
  // Janela de battle: clique num inimigo escolhe (ou tira) o alvo.

  battleHtml(win, buttons) {
    const rows = this.battle.map(e => `<div class="inv-battle-row${e.target ? ' target' : ''}" data-enemy="${e.id}">
        <span class="inv-battle-name">${e.name}</span>
        <div class="inv-battle-hp${e.hp <= 25 ? ' low' : e.hp <= 50 ? ' mid' : ''}"><i style="width:${e.hp}%"></i></div>
      </div>`).join('');
    return `<section class="inv-win${win.min ? ' min' : ''}" data-win="${win.id}">
      <header class="inv-head"><span class="inv-title">Battle</span><span class="inv-cap">${this.battle.length}</span>${buttons}</header>
      <div class="inv-body"><div class="inv-battle">${rows || '<div class="inv-battle-empty">Nenhum inimigo à vista</div>'}</div></div>
    </section>`;
  }

  // ================================================================================================================================================================================================================================================
  // toggleWindow
  // Abre a janela (skills embaixo do inventário, battle no topo da coluna da
  // esquerda) ou fecha se já está aberta.

  toggleWindow(kind) {
    const found = this.findWindow(kind);
    if (found) {
      this.layout[found.col].splice(found.i, 1);
    } else if (kind === 'battle') {
      this.layout.left.unshift(this.makeWindow('battle', null));
    } else {
      const above = this.findWindow('vitals') || this.findWindow('inventory');
      const col = above ? above.col : 'right';
      this.layout[col].splice(above ? above.i + 1 : 0, 0, this.makeWindow(kind, null));
    }
    this.scheduleSave();
    this.lastKey = '';
    if (!found) {
      this.update();
      this.render();
      this.flash(kind);
    }
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
    document.querySelectorAll('.inv-slot').forEach(el => {
      if (el !== sourceEl && this.canDropOn(item.type, item.uid, this.placeOf(el))) el.classList.add('can-drop');
    });
    this.drag = { kind: 'item', from, item, ghost, sourceEl };
    this.moveGhost(evt);
  }

  moveGhost(evt) {
    this.drag.ghost.style.left = `${evt.clientX + 6}px`;
    this.drag.ghost.style.top = `${evt.clientY + 6}px`;
    const slot = document.elementFromPoint(evt.clientX, evt.clientY)?.closest('.inv-slot');
    const { item } = this.drag;
    this.markSlot(slot && slot !== this.drag.sourceEl ? slot : null, (place) => this.canDropOn(item.type, item.uid, place));
  }

  // ================================================================================================================================================================================================================================================
  // markSlot
  // Espaço sob o item arrastado: borda verde se ele vai ali, vermelha se não.

  markSlot(slot, accepts) {
    document.querySelectorAll('.inv-slot.over').forEach(el => el.classList.remove('over', 'reject'));
    if (!slot) return;
    slot.classList.add('over');
    if (!accepts(this.placeOf(slot))) slot.classList.add('reject');
  }

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
    return itemInfo(type).slot === place.key;
  }

  endItemDrag(evt) {
    const { from, item, ghost } = this.drag;
    ghost.remove();
    document.querySelectorAll('.inv-slot').forEach(el => el.classList.remove('can-drop', 'over', 'reject', 'source'));
    this.drag = null;
    const target = document.elementFromPoint(evt.clientX, evt.clientY);
    const slot = target && target.closest('.inv-slot');
    if (slot && !this.canDropOn(item.type, item.uid, this.placeOf(slot))) return;
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
      const row = evt.target.closest('.inv-battle-row');
      if (row) {
        const target = this.game.player && this.game.player.target;
        this.game.send({ type: 'attack', targetId: target && target.id === row.dataset.enemy ? null : row.dataset.enemy });
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
      if (!slot || obj.isCorpse || !this.canDropOn(objectIdType(obj.id), null, this.placeOf(slot))) return;
      this.sendMove({ t: 'g', id: obj.id }, this.placeOf(slot), obj.count || 1, evt);
    });

    document.addEventListener('click', (evt) => {
      const btn = evt.target.closest('.inv-btn');
      if (!btn || !inPanels(btn)) return;
      const found = this.findWindow(btn.closest('.inv-win').dataset.win);
      if (!found) return;
      if (btn.dataset.act === 'skills' || btn.dataset.act === 'battle') {
        this.toggleWindow(btn.dataset.act);
        return;
      }
      if (btn.dataset.act === 'follow') {
        this.game.send({ type: 'toggleFollow' });
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
      const item = this.itemAt(this.placeOf(slot));
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
      if (!target) return false;
      this.game.cancelPendingWalk();
      this.game.send({ type: 'openContainer', itemId: target.id });
      return true;
    };
    this.game.canvas.addEventListener('dblclick', openGround);
    this.game.canvas.addEventListener('contextmenu', (evt) => {
      if (openGround(evt)) evt.preventDefault();
    });
  }
}
