// js/views/inventory-ui.js

import { getAsset, spriteFrame, splitType, objectIdType, displayName, objectUse } from '../../shared/assets.js';
import { getLevel } from '../core/geometry.js';
import { itemInfo, stackFrame } from '../../shared/items.js';
import { PLAYER_SPRITES, DEFAULT_GENDER } from '../../shared/catalog.js';
import { CORPSE_ROW } from './sprite-registry.js';
import { describeItem, describeEntity } from './look.js';

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
// ================================================================================================================================================================================================================================================
// patchChildren
// Deixa os filhos de target iguais aos de source reaproveitando os nós que
// já existem: troca só atributos, textos e nós de outro tipo.

function patchChildren(target, source) {
  const next = [...source.childNodes];
  while (target.childNodes.length > next.length) target.lastChild.remove();
  next.forEach((node, i) => {
    const current = target.childNodes[i];
    if (!current) target.appendChild(node);
    else patchNode(current, node);
  });
}

// ================================================================================================================================================================================================================================================
// patchNode

function patchNode(current, node) {
  if (current.nodeType !== node.nodeType || current.nodeName !== node.nodeName) {
    current.replaceWith(node);
    return;
  }
  if (current.nodeType !== Node.ELEMENT_NODE) {
    if (current.nodeValue !== node.nodeValue) current.nodeValue = node.nodeValue;
    return;
  }
  for (const attr of [...current.attributes]) {
    if (!node.hasAttribute(attr.name) && attr.name !== 'data-fade-bound') current.removeAttribute(attr.name);
  }
  for (const attr of [...node.attributes]) {
    if (current.getAttribute(attr.name) !== attr.value) current.setAttribute(attr.name, attr.value);
  }
  patchChildren(current, node);
}

// ================================================================================================================================================================================================================================================
// svgIcon
// Ícones de linha (a partir dos SVGs da pasta TRANSF): o traço segue a cor do
// texto (currentColor). Todos do mesmo grupo usam a mesma escala, então
// mantêm a proporção e o tamanho relativo de quando foram desenhados;
// shrink diminui um ícone sem afinar o traço.

function svgIcon(viewBox, shapes, scale, cls = '', shrink = 1) {
  const [, , w, h] = viewBox.split(' ').map(Number);
  const size = scale * shrink;
  return `<svg${cls ? ` class="${cls}"` : ''} width="${(w * size).toFixed(1)}" height="${(h * size).toFixed(1)}" viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="${(1.91 / shrink).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round">${shapes}</svg>`;
}

const SLOT_ICON_SCALE = 22 / 23.36;
const MODE_ICON_SCALE = 11 / 19.84;

const ICONS = {
  amuleto: svgIcon('0 0 16.21 23.36', '<path d="M.95.95c0,7.15,3.58,10.73,7.15,13.11,3.58-2.38,7.15-5.96,7.15-13.11"/><circle cx="8.11" cy="18.83" r="3.58"/>', SLOT_ICON_SCALE, 'inv-hint', 0.8),
  cabeca: svgIcon('0 0 18.59 16.21', '<path d="M.95,9.3C.95,4.69,4.69.95,9.3.95s8.34,3.74,8.34,8.34v3.58H.95v-3.58Z"/><path d="M4.53,12.87v2.38M14.06,12.87v2.38"/>', SLOT_ICON_SCALE, 'inv-hint'),
  mochila: svgIcon('0 0 17.72 21', '<path d="M16.77,14.6c0,4.37-3.54,5.44-7.91,5.44S.95,18.97.95,14.6s3.54-7.91,7.91-7.91,7.91,3.54,7.91,7.91Z"/><polyline points="6.08 4.59 4.85 .95 6.61 2.18 8.86 .95 10.89 2.18 12.87 .95 11.64 4.59"/>', SLOT_ICON_SCALE, 'inv-hint'),
  arma: svgIcon('0 0 23.36 23.36', '<path d="M14.66,18.24L.95,4.53V.95h3.58l13.71,13.71"/><path d="M12.87,20.02l7.15-7.15"/><path d="M16.45,16.45l4.77,4.77"/><path d="M20.02,22.41l2.38-2.38"/>', SLOT_ICON_SCALE, 'inv-hint'),
  corpo: svgIcon('0 0 20.98 20.98', '<path d="M5.72.95l4.77,2.38L15.26.95l4.77,4.77-3.58,3.58v10.73H4.53v-10.73L.95,5.72,5.72.95Z"/>', SLOT_ICON_SCALE, 'inv-hint'),
  escudo: svgIcon('0 0 18.59 23.36', '<path d="M9.3.95l8.34,3.58v5.96c0,5.96-3.58,9.54-8.34,11.92C4.53,20.02.95,16.45.95,10.49v-5.96L9.3.95Z"/>', SLOT_ICON_SCALE, 'inv-hint'),
  anel: svgIcon('0 0 16.21 22.17', '<circle cx="8.11" cy="14.06" r="7.15"/><path d="M5.72,4.53l2.38-3.58,2.38,3.58"/>', SLOT_ICON_SCALE, 'inv-hint', 0.8),
  pernas: svgIcon('0 0 13.83 20.98', '<path d="M.95.95h11.92l-1.19,19.07h-3.58l-1.19-11.92-1.19,11.92h-3.58L.95.95Z"/>', SLOT_ICON_SCALE, 'inv-hint'),
  municao: svgIcon('0 0 15.59 15.59', '<path d="M.95,14.63L13.44,2.15M8.68.95h5.96v5.96"/>', SLOT_ICON_SCALE, 'inv-hint'),
  pes: svgIcon('0 0 16.21 19.79', '<path d="M.95.95h5.96v10.73l8.34,2.38v4.77H.95V.95Z"/>', SLOT_ICON_SCALE, 'inv-hint', 0.8)
};
const FOLLOW_ICONS = {
  follow: svgIcon('0 0 17.4 19.84', '<circle cx="14.06" cy="3.34" r="2.38"/><path d="M5.13,7.57l4.17-2.38,3.58,3.58,3.58.6"/><path d="M8.82,11.84l4.05,1.09-1.19,5.96"/><path d="M11.32,7.2l-5,6.92-5.36,1.19"/>', MODE_ICON_SCALE),
  attack: svgIcon('0 0 19.79 19.19', '<path d="M1.55.95l13.11,13.11M18.24.95L5.13,14.06"/><path d="M12.28,16.45l4.77-4.77M2.74,11.68l4.77,4.77"/><path d="M15.85,15.26l2.98,2.98M3.93,15.26l-2.98,2.98"/>', MODE_ICON_SCALE),
  stand: svgIcon('0 0 11.44 19.84', '<circle cx="5.72" cy="3.4" r="2.44"/><path d="M5.72,8.76v4.17"/><path d="M.95,9.95l4.77-1.79,4.77,1.79"/><path d="M5.72,12.93l-4.17,5.96"/><path d="M5.72,12.93l4.17,5.96"/>', MODE_ICON_SCALE)
};
const SKILL_NAMES = {
  magic: 'Magic', fist: 'Fist', club: 'Club', sword: 'Sword', axe: 'Axe',
  distance: 'Distance', shielding: 'Shielding', fishing: 'Fishing'
};
const SKILL_ORDER = ['magic', 'fist', 'sword', 'axe', 'distance', 'shielding', 'fishing'];
const SPEED_FULL = 640;
const PITCH = 40;
const SAVE_DELAY_MS = 600;

const MAP_USES = ['placa', 'livro', 'bau-quest', 'corda', 'pa', 'descer'];

// ================================================================================================================================================================================================================================================
// aimsWith
// Item usado com a mira: potion (em player ou no chão), corda e pá.

function aimsWith(type) {
  const use = objectUse(type);
  return !!itemInfo(type).heal || use === 'ferramenta-corda' || use === 'ferramenta-pa';
}

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
    if (!obj || objectUse(objectIdType(obj.id)) || !itemInfo(objectIdType(obj.id)).size) return null;
    return obj;
  }

  // ================================================================================================================================================================================================================================================
  // startAim
  // Potion clicada: o cursor vira mira até o próximo clique (Esc ou botão
  // direito cancelam).

  startAim(from) {
    this.aim = { from, at: performance.now() };
    document.body.classList.add('inv-aiming');
  }

  // ================================================================================================================================================================================================================================================
  // stopAim

  stopAim() {
    this.aim = null;
    document.body.classList.remove('inv-aiming');
  }

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
  }

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
  }

  // ================================================================================================================================================================================================================================================
  // usableUnderMouse
  // Comida ou potion no chão sob o mouse (duplo clique ou botão direito usa;
  // o player anda até o lado se estiver longe).

  usableUnderMouse() {
    const input = this.game.inputController;
    const obj = input && !input.hoverCorpse ? input.hoverObject : null;
    if (!obj) return null;
    if (MAP_USES.includes(objectUse(objectIdType(obj.id)))) return obj;
    if (obj.movable !== true) return null;
    const info = itemInfo(objectIdType(obj.id));
    return info.food || info.heal || objectUse(objectIdType(obj.id)) ? obj : null;
  }

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
  }

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
  }

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
      min: !!saved.min,
      bars: Array.isArray(saved.bars) ? saved.bars.filter(b => typeof b === 'string') : []
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
  }

  // ================================================================================================================================================================================================================================================
  // spriteHtml
  // O 1º quadro do item em 32 px (recortado da folha do gerador); item de
  // pilha usa o quadro da quantidade (stackFrame).

  spriteHtml(type, count = 1) {
    const frame = spriteFrame(type);
    const asset = getAsset(splitType(type).asset);
    if (!frame || !asset) return '<i class="inv-spr missing"></i>';
    const scale = 32 / frame.size;
    const width = Math.max(1, asset.quadros || 1) * asset.quadro * scale;
    const height = asset.quadro * scale;
    const x = frame.x + (asset.pilha ? Math.min(stackFrame(count), (asset.quadros || 1) - 1) * asset.quadro : 0);
    return `<i class="inv-spr" style="background-image:url(${frame.url});background-size:${width}px ${height}px;background-position:${-x * scale}px ${-frame.y * scale}px"></i>`;
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
      const icon = hintKey ? ICONS[hintKey] : '';
      return `<div class="inv-slot" data-place="${key}">${icon}</div>`;
    }
    const info = itemInfo(item.type);
    const count = item.count > 1 ? `<span class="inv-count">${item.count}</span>` : '';
    const open = item.items && this.isOpen(item.uid) ? '<span class="inv-open"></span>' : '';
    return `<div class="inv-slot filled" data-place="${key}" data-uid="${item.uid}">${this.spriteHtml(item.type, item.count)}${count}${open}</div>`;
  }

  // ================================================================================================================================================================================================================================================
  // windowHtml

  windowHtml(win) {
    const buttons = (closable) => `<button class="inv-btn" data-act="min" type="button" aria-label="Minimizar">${win.min ? '+' : '–'}</button>` +
      (closable ? '<button class="inv-btn close" data-act="close" type="button" aria-label="Fechar">×</button>' : '');
    if (win.kind === 'inventory') {
      const { equip, cap } = this.view;
      const free = Math.max(0, cap.max - cap.used);
      const capBox = `<div class="inv-capbox${free < cap.max * 0.15 ? ' heavy' : ''}">${Math.floor(free)}</div>`;
      const spare = '<div class="inv-capbox"></div>';
      const last = EQUIP_LAYOUT.length - 1;
      const cell = ([key], i) => key ? this.slotHtml(equip[key], { t: 'e', key }, key) : (i === last ? capBox : (i === last - 2 ? spare : ''));
      const top = [`<div class="inv-modes">${this.followHtml()}${this.attackModeHtml()}</div>`, '', spare];
      const cells = [0, 1, 2].map(col => `<div class="inv-dollcol">${top[col]}${EQUIP_LAYOUT.map((entry, i) => i % 3 === col ? cell(entry, i) : '').join('')}</div>`).join('');
      return `<section class="inv-win${win.min ? ' min' : ''}" data-win="${win.id}">
        <header class="inv-head"><span class="inv-title">Inventário</span>${buttons(false)}</header>
        <div class="inv-body"><div class="inv-doll">${cells}</div></div>
      </section>`;
    }
    if (win.kind === 'skills') return this.skillsHtml(win, buttons(false));
    if (win.kind === 'battle') return this.battleHtml(win, buttons(false));
    if (win.kind === 'vitals') return this.vitalsHtml(win);
    const box = this.findContainer(win.uid);
    if (!box) return '';
    const slots = box.items.map((item, i) => this.slotHtml(item, { t: 'c', uid: box.uid, i })).join('');
    const up = this.parentOf(win.uid) ? '<button class="inv-btn" data-act="up" type="button" aria-label="Voltar pro container de fora">↑</button>' : '';
    return `<section class="inv-win${win.min ? ' min' : ''}" data-win="${win.id}">
      <header class="inv-head"><span class="inv-icon">${this.spriteHtml(box.type)}</span>
        <span class="inv-title">${this.windowTitle(win, box)}</span>${up}${buttons(true)}</header>
      <div class="inv-body"><div class="inv-scroller" style="height:${Math.min(win.rows, Math.ceil(box.items.length / 4)) * PITCH + 8}px"><div class="inv-grid">${slots}</div></div></div>
      <div class="inv-resize"></div>
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
  // Janela de skills: Level e XP; vida, mana, cap livre, speed e food; e os
  // skills. Clique numa linha abre ou fecha a barra de progresso dela.

  skillsHtml(win, buttons) {
    const stats = this.view.stats;
    if (!stats) return '';
    const cap = this.view.cap;
    const fmt = (n) => Number(n).toLocaleString('pt-BR');
    const pctOf = (value, max) => (max > 0 ? Math.max(0, Math.min(100, Math.round(value / max * 100))) : 0);
    const open = new Set(win.bars || []);
    const line = (key, label, value, pct, kind = '') => {
      const hasBar = pct !== undefined;
      const bar = hasBar && open.has(key) ? `<div class="inv-skbar${kind ? ` ${kind}` : ''}"><i style="width:${pct}%"></i></div>` : '';
      return `<div class="inv-skline${hasBar ? ' toggles' : ''}"${hasBar ? ` data-bar="${key}"` : ''}><div class="inv-skrow"><span>${label}</span><b>${value}</b></div>${bar}</div>`;
    };
    const skill = (key) => {
      const entry = stats.skills[key];
      const value = entry.bonus ? `${entry.lvl} <em class="inv-skbonus">+ ${entry.bonus}</em>` : entry.lvl;
      return line(key, SKILL_NAMES[key], value, entry.pct);
    };
    const hpPct = pctOf(stats.hp, stats.maxHp);
    const free = Math.max(0, cap.max - cap.used);
    const body = [
      line('xp', 'XP', fmt(stats.experience)),
      line('level', 'Level', stats.level, stats.levelPct),
      '<div class="inv-sksep"></div>',
      line('hp', 'Hit Points', fmt(stats.hp), hpPct, `hp${hpPct <= 25 ? ' low' : hpPct <= 50 ? ' mid' : ''}`),
      line('mana', 'Mana', fmt(stats.mana), pctOf(stats.mana, stats.maxMana), 'mp'),
      line('cap', 'Capacity', Math.floor(free), pctOf(free, cap.max), 'cap'),
      line('speed', 'Speed', fmt(stats.speed || 0), pctOf(stats.speed || 0, SPEED_FULL), 'speed'),
      line('food', 'Food', stats.food ? `${Math.floor(stats.food / 60)}:${String(stats.food % 60).padStart(2, '0')}` : '—'),
      '<div class="inv-sksep"></div>',
      ...SKILL_ORDER.map(skill)
    ].join('');
    return `<section class="inv-win${win.min ? ' min' : ''}" data-win="${win.id}">
      <header class="inv-head"><span class="inv-title">Skills</span>${buttons}</header>
      <div class="inv-body"><div class="inv-skills">${body}</div></div>
    </section>`;
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
  // vitalsHtml
  // Barras de vida e mana com o valor atual/máximo dentro. A janela toda é a
  // alça: dá pra arrastar, mas não minimizar nem fechar.

  vitalsHtml(win) {
    const stats = this.view.stats;
    if (!stats) return '';
    const pct = (value, max) => (max > 0 ? Math.max(0, Math.min(100, value / max * 100)) : 0);
    const fmt = (n) => Number(n).toLocaleString('pt-BR');
    const bar = (kind, value, max) => `<div class="inv-vbar ${kind}"><i style="width:${pct(value, max)}%"></i><span>${fmt(value)} / ${fmt(max)}</span></div>`;
    return `<section class="inv-win" data-win="${win.id}">
      <header class="inv-head inv-vitals" aria-label="Vida e mana">
        ${bar('hp', stats.hp, stats.maxHp)}
        ${bar('mana', stats.mana, stats.maxMana)}
      </header>
    </section>`;
  }

  // ================================================================================================================================================================================================================================================
  // followHtml
  // Seguir o alvo (boneco correndo verde) ou ficar parado (boneco em pé
  // cinza), no canto do inventário, ao lado do auto ataque.

  followHtml() {
    const player = this.game.player;
    if (!player) return '';
    const follow = player.followMode !== false;
    return `<button class="inv-follow ${follow ? 'on' : 'off'}" data-act="follow" type="button">${FOLLOW_ICONS[follow ? 'follow' : 'stand']}</button>`;
  }

  // ================================================================================================================================================================================================================================================
  // attackModeHtml
  // Auto ataque: espadas verdes ligado (ataca quem se aproxima), cinza
  // desligado (só o alvo escolhido), ao lado do seguir.

  attackModeHtml() {
    const player = this.game.player;
    if (!player) return '';
    const attack = !!player.attackMode;
    return `<button class="inv-follow ${attack ? 'on' : 'off'}" data-act="attackmode" type="button">${FOLLOW_ICONS.attack}</button>`;
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
      <header class="inv-head"><span class="inv-title">Battle</span>${buttons}</header>
      <div class="inv-body"><div class="inv-battle">${rows || '<div class="inv-battle-empty">Nenhum inimigo à vista</div>'}</div></div>
    </section>`;
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
    ghost.innerHTML = this.spriteHtml(item.type, item.count);
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
    this.bindAim();

    document.addEventListener('pointerdown', (evt) => {
      if (this.qty && !evt.target.closest('.inv-qty')) this.closeQty();
      if (evt.button !== 0 || !inPanels(evt.target) || evt.target.closest('.inv-btn')) return;
      const row = evt.target.closest('.inv-battle-row');
      if (row && evt.shiftKey) {
        const enemy = this.game.session && this.game.session.enemies.find(e => e.id === row.dataset.enemy);
        if (enemy) this.game.look(describeEntity(enemy));
        return;
      }
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
      if (item && !item.items && (itemInfo(item.type).food || objectUse(item.type) === 'livro')) {
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
