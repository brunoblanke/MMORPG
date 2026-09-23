// js/config.js

import { TILE, GRID_WIDTH, GRID_HEIGHT, STACK_OFFSET } from '../shared/constants.js';

export const CONFIG = {
  tileSize: TILE,
  mapWidth: GRID_WIDTH,
  mapHeight: GRID_HEIGHT,
  mapDataUrl: 'data/map.json',
  patrolRadius: 4,
  detectionRadius: 7,
  attackCooldown: 1500,
  // Escalas globais (player e inimigos, sem mexer nos atributos por lvl):
  // 0.4 = 60% mais fraco / 60% mais lento.
  damageScale: 0.4,   // multiplica o dano de cada golpe
  speedScale: 0.4,    // divide o tempo de passo e das animações de andar
  enemyRespawnTime: 10000,
  corpseFrameDuration: 60000,
  corpseFrameCount: 3,
  stackOffsetX: STACK_OFFSET,
  stackOffsetY: STACK_OFFSET,
  maxStackHeight: 4,
  // Altura de um andar em volumes: sobre floorHeight-1 volumes dá pra subir
  // no piso do andar de cima; sobre floorHeight ou mais a criatura já conta
  // como andar de cima. Itens nunca mudam de andar por estarem empilhados.
  floorHeight: 4,
  playerSpriteFrameWidth: 64,
  playerSpriteFrameHeight: 64,
  playerSpriteWalkFrames: 8,
  playerSpriteDirections: ['sul', 'norte', 'leste', 'oeste'],
  playerFrameDuration: 150,

  objectSpriteFrameWidth: 32,
  objectSpriteFrameHeight: 32,

  devMode: false,

  baseMoveDuration: 300,
  minMoveDuration: 80,

  // Patrulha: o bicho escolhe um sqm na área dele, anda até lá e para um
  // tempo. O lvl só muda a velocidade do passo (spd); pausas e intervalos são
  // os mesmos pra todo mundo.
  patrolWalkStepFactor: 1.3,   // passo da patrulha = duração do passo × isso (mais calmo que perseguindo)
  patrolPauseMin: 1500,        // ms parado entre um passeio e outro
  patrolPauseMax: 5000,
  // Perseguição, colado no player: de vez em quando troca de lado.
  combatSidestepIntervalMin: 2500,
  combatSidestepIntervalMax: 6000,
  // Cerco: peso pra preferir sqms longe dos outros atacantes (espalhar em volta).
  chaseSpreadWeight: 2.5,
  // Sem rota até o player (parede, casa fechada — outros inimigos não contam):
  // patrulha e tenta de novo depois desse tempo (ms).
  chaseRetryDelay: 2000,
  // Outro inimigo parado no caminho: espera e tenta um desvio a cada X ms.
  chaseRerouteDelay: 600
};