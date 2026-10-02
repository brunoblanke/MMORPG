// js/systems/voices.js

import { creatureVoices } from '../../shared/assets.js';
import { getLevel } from '../core/geometry.js';
import { randFloat } from '../utils/helpers.js';

// Falas das criaturas (gerador → Criaturas → Falas): de tempos em tempos a
// criatura diz uma delas, em cima dela, se tem player por perto pra ouvir.

export const VOICE_MIN_MS = 15000;
export const VOICE_MAX_MS = 40000;
export const VOICE_RANGE = 8;

// ================================================================================================================================================================================================================================================
// updateVoice

export function updateVoice(sim, enemy, player, now) {
  const lines = creatureVoices(enemy.creature);
  if (!lines.length) return;
  if (enemy.voiceAt === undefined) enemy.voiceAt = now + randFloat(VOICE_MIN_MS, VOICE_MAX_MS);
  if (now < enemy.voiceAt) return;
  enemy.voiceAt = now + randFloat(VOICE_MIN_MS, VOICE_MAX_MS);
  if (!player || getLevel(player) !== getLevel(enemy)) return;
  if (Math.max(Math.abs(player.x - enemy.x), Math.abs(player.y - enemy.y)) > VOICE_RANGE) return;
  const text = lines[Math.floor(Math.random() * lines.length)];
  sim.emit({ type: 'speech', speakerId: enemy.id, name: null, text, x: enemy.x, y: enemy.y, z: enemy.z || 0, orange: true });
}
