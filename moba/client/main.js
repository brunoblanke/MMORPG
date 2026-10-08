// moba/client/main.js

import { ARENA } from './engine/config.js';
import { render, toWorld, pruneVisuals, effectTiles, TILE } from './render.js';
import { drawHud as hud } from './hud.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const lobby = document.getElementById('lobby');
const params = new URLSearchParams(location.search);
const scene = { state: null, myId: null, myTeam: null, camera: { x: ARENA.width * TILE / 2, y: ARENA.height * TILE / 2 }, width: 0, height: 0, now: 0, effects: [], missiles: [], texts: [], mouse: { x: 0, y: 0 } };
const choice = { team: params.get('team') || 'blue', vocation: params.get('vocation') || '' };
let clientId = null;
let rightHeld = false;

// ================================================================================================================================================================================================================================================
// resize
// A tela do jogo acompanha a janela.

function resize() {
  scene.width = canvas.width = window.innerWidth;
  scene.height = canvas.height = window.innerHeight;
}

// ================================================================================================================================================================================================================================================
// post
// Manda um JSON pro servidor (as ordens e o pedido de herói vão por HTTP).

function post(path, body) {
  return fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true }).then(response => response.json()).catch(() => ({ ok: false }));
}

// ================================================================================================================================================================================================================================================
// command
// Manda uma ordem pro herói do jogador.

function command(payload) {
  if (scene.myId && clientId) post('command', { id: clientId, command: payload });
}

// ================================================================================================================================================================================================================================================
// join
// Pede o herói da vocação e do time escolhidos.

async function join(team, vocation) {
  if (!clientId) return;
  const result = await post('join', { id: clientId, team, vocation });
  if (result.ok) takeHero(result.heroId);
  else document.getElementById('lobbyMessage').textContent = 'Esse herói já é de outro jogador.';
}

// ================================================================================================================================================================================================================================================
// takeHero
// O jogador agora controla o herói heroId.

function takeHero(heroId) {
  scene.myId = heroId;
  scene.myTeam = heroId ? heroId.split('-')[0] : null;
  if (heroId) lobby.hidden = true;
}

// ================================================================================================================================================================================================================================================
// takeEvents
// Transforma os eventos do tick em efeitos, projéteis e números na tela.

function takeEvents(events) {
  for (const event of events) {
    if (event.type === 'effect') scene.effects.push({ name: event.name, tiles: effectTiles(event), start: scene.now });
    else if (event.type === 'missile') scene.missiles.push({ kind: event.kind, fromX: event.fromX, fromY: event.fromY, toX: event.toX, toY: event.toY, start: scene.now });
    else if (event.type === 'damage') scene.texts.push({ x: event.x, y: event.y, amount: event.amount, element: event.element, start: scene.now });
    else if (event.type === 'heal') scene.texts.push({ x: event.x, y: event.y, amount: event.amount, heal: true, start: scene.now });
  }
}

// ================================================================================================================================================================================================================================================
// connect
// Abre o fluxo de eventos do servidor; cada mensagem de estado vira a cena atual.

function connect() {
  const stream = new EventSource('events');
  stream.addEventListener('hello', (event) => {
    clientId = JSON.parse(event.data).id;
    if (choice.vocation) join(choice.team, choice.vocation);
  });
  stream.addEventListener('joined', (event) => {
    const message = JSON.parse(event.data);
    if (message.id === clientId) takeHero(message.heroId);
  });
  stream.onmessage = (event) => {
    const state = JSON.parse(event.data);
    takeEvents(state.events || []);
    scene.state = state;
  };
}

// ================================================================================================================================================================================================================================================
// followCamera
// A câmera acompanha o herói do jogador (ou o meio dos heróis, se só assiste).

function followCamera() {
  const state = scene.state;
  if (!state) return;
  const me = state.heroes.find(hero => hero.id === scene.myId);
  const alive = state.heroes.filter(hero => hero.alive);
  const target = me && me.alive ? me : { x: alive.reduce((sum, hero) => sum + hero.x, 0) / (alive.length || 1), y: ARENA.height / 2 };
  const half = { x: scene.width / 2 / 1.5 / TILE, y: scene.height / 2 / 1.5 / TILE };
  const x = Math.min(Math.max(target.x, Math.min(half.x, ARENA.width / 2)), Math.max(ARENA.width - half.x, ARENA.width / 2));
  const y = Math.min(Math.max(target.y, Math.min(half.y, ARENA.height / 2)), Math.max(ARENA.height - half.y, ARENA.height / 2));
  scene.camera.x += (x * TILE - scene.camera.x) * 0.25;
  scene.camera.y += (y * TILE - scene.camera.y) * 0.25;
}

// ================================================================================================================================================================================================================================================
// unitAt
// O inimigo (herói, minion ou estrutura) sob o ponto do mundo, ou null.

function unitAt(point) {
  const state = scene.state;
  if (!state) return null;
  const candidates = [
    ...state.heroes.filter(hero => hero.alive).map(hero => ({ ...hero, radius: 0.6 })),
    ...state.minions.map(minion => ({ ...minion, radius: 0.6 })),
    ...state.structures.filter(structure => structure.alive).map(structure => ({ ...structure, radius: structure.structure === 'nexus' ? 1.8 : 1.1 }))
  ];
  return candidates.filter(unit => unit.team !== scene.myTeam && Math.hypot(unit.x - point.x, unit.y - point.y) <= unit.radius + 0.3)
    .sort((a, b) => Math.hypot(a.x - point.x, a.y - point.y) - Math.hypot(b.x - point.x, b.y - point.y))[0] || null;
}

// ================================================================================================================================================================================================================================================
// rightClick
// Botão direito: atacar o inimigo que está sob o mouse, ou andar até o ponto.

function rightClick() {
  const point = toWorld(scene, scene.mouse.x, scene.mouse.y);
  const target = unitAt(point);
  command(target ? { type: 'attack', targetId: target.id } : { type: 'move', x: point.x, y: point.y });
}

// ================================================================================================================================================================================================================================================
// setupInput
// Mouse (botão direito anda ou ataca, segurado continua andando) e teclado (Q, W e E lançam no mouse; S para).

function setupInput() {
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  canvas.addEventListener('mousemove', (event) => {
    scene.mouse = { x: event.clientX, y: event.clientY };
  });
  canvas.addEventListener('mousedown', (event) => {
    scene.mouse = { x: event.clientX, y: event.clientY };
    if (event.button === 2) {
      rightHeld = true;
      rightClick();
    }
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 2) rightHeld = false;
  });
  setInterval(() => {
    if (rightHeld) rightClick();
  }, 150);
  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    const slot = { q: 0, w: 1, e: 2 }[event.key.toLowerCase()];
    if (slot !== undefined) {
      const point = toWorld(scene, scene.mouse.x, scene.mouse.y);
      command({ type: 'cast', slot, x: point.x, y: point.y });
    } else if (event.key.toLowerCase() === 's') command({ type: 'stop' });
  });
}

// ================================================================================================================================================================================================================================================
// setupLobby
// A escolha do time e da vocação (ou só assistir).

function setupLobby() {
  for (const button of document.querySelectorAll('#teams button')) {
    button.classList.toggle('on', button.dataset.team === choice.team);
    button.addEventListener('click', () => {
      choice.team = button.dataset.team;
      document.querySelectorAll('#teams button').forEach(item => item.classList.toggle('on', item === button));
    });
  }
  for (const button of document.querySelectorAll('#vocations button')) {
    button.addEventListener('click', () => join(choice.team, button.dataset.vocation));
  }
  document.getElementById('spectate').addEventListener('click', () => { lobby.hidden = true; });
  if (choice.vocation) lobby.hidden = true;
}

// ================================================================================================================================================================================================================================================
// frame
// Um quadro: câmera, cena e interface.

function frame(now) {
  scene.now = now;
  followCamera();
  pruneVisuals(scene);
  render(ctx, scene);
  hud(ctx, scene);
  requestAnimationFrame(frame);
}

window.addEventListener('resize', resize);
resize();
setupInput();
setupLobby();
connect();
requestAnimationFrame(frame);

