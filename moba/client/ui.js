// moba/client/ui.js

import { ITEMS, HEROES, MAX_ITEMS } from './engine/config.js';
import { itemUrl } from './assets.js';

const STAT_NAMES = { attack: 'Ataque', power: 'Poder', hp: 'Vida', mana: 'Mana', armor: 'Armadura', magicResist: 'Res. mágica', speed: 'Velocidade', hpRegen: 'Regen. vida', attackSpeed: 'Vel. ataque %' };
const NAMES = { blue: 'Azul', red: 'Vermelho' };
const FEED_MS = 7000;
const ANNOUNCE_MS = 4500;
const dom = {};
let sendCommand = () => {};
let shopSignature = '';
let bagSignature = '';

// ================================================================================================================================================================================================================================================
// heroName
// O nome do herói pelo id (time e vocação).

export function heroName(id) {
  const [team, vocation] = String(id || '').split('-');
  return HEROES[vocation] ? `${NAMES[team]} ${HEROES[vocation].name}` : String(id);
}

// ================================================================================================================================================================================================================================================
// statsText
// Os números de um item em texto curto.

function statsText(item) {
  if (item.consumable) return Object.entries(item.consumable).map(([key, value]) => `+${value} ${key === 'hp' ? 'vida' : 'mana'}`).join(' ');
  return Object.entries(item.stats).map(([key, value]) => `+${value} ${STAT_NAMES[key]}`).join(' · ');
}

// ================================================================================================================================================================================================================================================
// icon
// O elemento de imagem do ícone do item.

function icon(id) {
  const image = document.createElement('img');
  image.src = itemUrl(ITEMS[id].icon);
  image.alt = ITEMS[id].name;
  return image;
}

// ================================================================================================================================================================================================================================================
// buildShop
// A loja: um cartão por item (ícone, nome, preço e números); clicar compra.

function buildShop() {
  dom.shopList.innerHTML = '';
  const ids = Object.keys(ITEMS).sort((a, b) => Number(!!ITEMS[a].consumable) - Number(!!ITEMS[b].consumable) || ITEMS[a].cost - ITEMS[b].cost);
  for (const id of ids) {
    const card = document.createElement('button');
    card.className = 'shop-item';
    card.dataset.item = id;
    card.append(icon(id));
    const text = document.createElement('span');
    text.innerHTML = `<b>${ITEMS[id].name}</b><i>${ITEMS[id].cost} ouro</i><small>${statsText(ITEMS[id])}</small>`;
    card.append(text);
    card.addEventListener('click', () => sendCommand({ type: 'buy', item: id }));
    dom.shopList.append(card);
  }
}

// ================================================================================================================================================================================================================================================
// updateShop
// Marca na loja o que dá pra comprar agora (na fonte, com ouro e espaço) e o que já tem.

function updateShop(me) {
  const signature = `${me ? `${Math.floor(me.gold / 10)}|${me.items.join(',')}|${me.inFountain}|${me.alive}` : 'x'}|${dom.shop.hidden}`;
  if (signature === shopSignature) return;
  shopSignature = signature;
  dom.shopNote.textContent = me && !me.inFountain ? 'Só dá pra comprar e vender na fonte da sua base.' : '';
  dom.shopGold.textContent = me ? `${Math.floor(me.gold)} ouro` : '';
  for (const card of dom.shopList.children) {
    const item = ITEMS[card.dataset.item];
    const owned = !item.consumable && me && me.items.includes(card.dataset.item);
    card.disabled = !me || !me.alive || !me.inFountain || me.gold < item.cost || me.items.length >= MAX_ITEMS || owned;
    card.classList.toggle('owned', !!owned);
  }
}

// ================================================================================================================================================================================================================================================
// updateBag
// A mochila (6 espaços): clicar bebe a poção; botão direito vende (na fonte).

function updateBag(me) {
  const signature = me ? `${me.items.join(',')}|${me.potionIn > 0}` : 'x';
  if (signature === bagSignature) return;
  bagSignature = signature;
  dom.bag.innerHTML = '';
  for (let slot = 0; slot < MAX_ITEMS; slot++) {
    const cell = document.createElement('div');
    cell.className = 'bag-slot';
    const id = me ? me.items[slot] : null;
    if (id) {
      cell.append(icon(id));
      cell.title = `${ITEMS[id].name} — ${statsText(ITEMS[id])}`;
      cell.addEventListener('click', () => sendCommand({ type: 'use', slot }));
      cell.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        sendCommand({ type: 'sell', slot });
      });
    }
    const key = document.createElement('em');
    key.textContent = String(slot + 1);
    cell.append(key);
    dom.bag.append(cell);
  }
}

// ================================================================================================================================================================================================================================================
// updateScoreboard
// O placar (Tab): os 4 heróis de cada time com nível, abates/mortes, ouro e itens.

function updateScoreboard(state, myId) {
  if (dom.scoreboard.hidden) return;
  const rows = ['blue', 'red'].map(team => {
    const heroes = state.heroes.filter(hero => hero.team === team);
    const body = heroes.map(hero => `<tr class="${hero.id === myId ? 'me' : ''}${hero.alive ? '' : ' dead'}"><td>${HEROES[hero.vocation].name}${hero.human ? ' ★' : ''}</td><td>${hero.level}</td><td>${hero.kills}/${hero.deaths}</td><td>${hero.gold}</td><td>${hero.items.map(id => `<img src="${itemUrl(ITEMS[id].icon)}" alt="">`).join('')}</td></tr>`).join('');
    return `<h3 class="${team}">${NAMES[team]}</h3><table><tr><th>Herói</th><th>Nv</th><th>K/D</th><th>Ouro</th><th>Itens</th></tr>${body}</table>`;
  });
  dom.scoreboard.innerHTML = rows.join('');
}

// ================================================================================================================================================================================================================================================
// say
// Põe uma linha no destaque do topo (some sozinha).

function say(text, team) {
  const line = document.createElement('div');
  line.className = `announce ${team || ''}`;
  line.textContent = text;
  dom.announce.append(line);
  setTimeout(() => line.remove(), ANNOUNCE_MS);
}

// ================================================================================================================================================================================================================================================
// addFeed
// Um acontecimento (abate, torre, boss) vira linha no canto e, os grandes, aviso no topo.

export function addFeed(event) {
  let text = null;
  let big = false;
  if (event.kind === 'kill') text = event.killer && HEROES[String(event.killer).split('-')[1]] ? `${heroName(event.killer)} abateu ${heroName(event.victim)}` : `${heroName(event.victim)} morreu`;
  else if (event.kind === 'tower') { text = `${NAMES[event.team]} derrubou uma torre`; big = true; }
  else if (event.kind === 'boss') { text = `${NAMES[event.team]} matou o ${event.name.toUpperCase()}!`; big = true; }
  else if (event.kind === 'bossSpawn') { text = `O ${event.name.toUpperCase()} nasceu na selva`; big = true; }
  if (!text) return;
  const line = document.createElement('div');
  line.className = `feed-line ${event.team || ''}`;
  line.textContent = text;
  dom.feed.append(line);
  while (dom.feed.children.length > 6) dom.feed.firstChild.remove();
  setTimeout(() => line.remove(), FEED_MS);
  if (big) say(text, event.team);
}

// ================================================================================================================================================================================================================================================
// setShop
// Abre, fecha ou alterna a loja.

export function toggleShop(force) {
  dom.shop.hidden = force === undefined ? !dom.shop.hidden : !force;
  shopSignature = '';
}

// ================================================================================================================================================================================================================================================
// showScoreboard
// Mostra ou esconde o placar.

export function showScoreboard(visible) {
  dom.scoreboard.hidden = !visible;
}

// ================================================================================================================================================================================================================================================
// updateUi
// Atualiza a interface (loja, mochila, placar) com o estado atual.

export function updateUi(state, myId) {
  const me = state.heroes.find(hero => hero.id === myId) || null;
  dom.shopButton.hidden = !me;
  dom.bag.hidden = !me;
  updateShop(me);
  updateBag(me);
  updateScoreboard(state, myId);
}

// ================================================================================================================================================================================================================================================
// initUi
// Liga a interface aos elementos da página; onCommand manda as ordens ao servidor.

export function initUi(onCommand) {
  sendCommand = onCommand;
  for (const id of ['shop', 'shopList', 'shopNote', 'shopGold', 'shopButton', 'shopClose', 'bag', 'scoreboard', 'feed', 'announce']) dom[id] = document.getElementById(id);
  buildShop();
  dom.shopButton.addEventListener('click', () => toggleShop());
  dom.shopClose.addEventListener('click', () => toggleShop(false));
  dom.bag.addEventListener('contextmenu', (event) => event.preventDefault());
}

