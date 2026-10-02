// js/views/inventory-ui/html.js

import { getAsset, spriteFrame, splitType, displayName, litAs } from '../../../shared/assets.js';
import { getLevel } from '../../core/geometry.js';
import { itemInfo, stackFrame } from '../../../shared/items.js';
import { PLAYER_SPRITES, DEFAULT_GENDER } from '../../../shared/catalog.js';
import { CORPSE_ROW } from '../sprite-registry.js';
import { ANIMATION_CYCLE_MS } from '../../../shared/constants.js';
import { EQUIP_LAYOUT, SKILL_NAMES, SKILL_ORDER, PITCH } from './common.js';
import { ICONS, FOLLOW_ICONS } from './icons.js';

// Métodos do InventoryUI (js/views/inventory-ui.js). O HTML de cada parte das janelas: espaços, containers, skills, vida e
// mana, seguir, auto ataque e battle.

export const htmlMethods = {

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
    const frames = asset.pilha ? 1 : frame.frames || 1;
    const animation = frames > 1
      ? `;--x0:${-x * scale}px;--x1:${-(x + frames * frame.size) * scale}px;animation:inv-anim ${ANIMATION_CYCLE_MS}ms steps(${frames}) infinite`
      : '';
    return `<i class="inv-spr" style="background-image:url(${frame.url});background-size:${width}px ${height}px;background-position:${-x * scale}px ${-frame.y * scale}px${animation}"></i>`;
  },

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
  },

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
    const look = (item.lit && litAs(item.type)) || item.type;
    return `<div class="inv-slot filled" data-place="${key}" data-uid="${item.uid}">${this.spriteHtml(look, item.count)}${count}</div>`;
  },

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
  },

  // ================================================================================================================================================================================================================================================
  // windowTitle
  // Nome do container; do chão, com (chão); cadáver, com (morto).

  windowTitle(win, box) {
    if (!win.ground) return itemInfo(box.type).name;
    const opened = this.view.opened.find(o => o.id === win.ground);
    const corpse = opened && opened.corpse;
    const name = corpse && opened.name && opened.item.uid === box.uid ? opened.name : itemInfo(box.type).name;
    return `${name} <em>${corpse ? '(morto)' : '(chão)'}</em>`;
  },

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
      line('cap', 'Capacity', Math.floor(free)),
      line('speed', 'Speed', fmt(stats.speed || 0)),
      line('food', 'Food', stats.food ? `${Math.floor(stats.food / 60)}:${String(stats.food % 60).padStart(2, '0')}` : '—'),
      '<div class="inv-sksep"></div>',
      ...SKILL_ORDER.map(skill)
    ].join('');
    return `<section class="inv-win${win.min ? ' min' : ''}" data-win="${win.id}">
      <header class="inv-head"><span class="inv-title">Skills</span>${buttons}</header>
      <div class="inv-body"><div class="inv-skills">${body}</div></div>
    </section>`;
  },

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
  },

  // ================================================================================================================================================================================================================================================
  // followHtml
  // Seguir o alvo (boneco correndo verde) ou ficar parado (boneco em pé
  // cinza), no canto do inventário, ao lado do auto ataque.

  followHtml() {
    const player = this.game.player;
    if (!player) return '';
    const follow = player.followMode !== false;
    return `<button class="inv-follow ${follow ? 'on' : 'off'}" data-act="follow" type="button">${FOLLOW_ICONS[follow ? 'follow' : 'stand']}</button>`;
  },

  // ================================================================================================================================================================================================================================================
  // attackModeHtml
  // Auto ataque: espadas verdes ligado (ataca quem se aproxima), cinza
  // desligado (só o alvo escolhido), ao lado do seguir.

  attackModeHtml() {
    const player = this.game.player;
    if (!player) return '';
    const attack = !!player.attackMode;
    return `<button class="inv-follow ${attack ? 'on' : 'off'}" data-act="attackmode" type="button">${FOLLOW_ICONS.attack}</button>`;
  },

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
  },

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
  },
};
