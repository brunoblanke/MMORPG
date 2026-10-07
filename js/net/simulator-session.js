// js/net/simulator-session.js

import { LocalSession } from './local-session.js';
import { buildTestCharacter, TEST_CHARACTERS } from './test-characters.js';

// Sessão do simulador (simulador.html): a simulação roda no navegador, com um
// Paladin de teste (nível 100, skills 100) que nunca é guardado, e o controlador
// do simulador ligado (systems/simulator.js).

export class SimulatorSession extends LocalSession {

  // ================================================================================================================================================================================================================================================
  // constructor

  constructor(mapData) {
    super(mapData, 'Simulator', 'male', {}, { simulator: true });
  }

  // ================================================================================================================================================================================================================================================
  // loadCharacter

  loadCharacter() {
    return buildTestCharacter('Simulator', TEST_CHARACTERS.Paladin);
  }

  // ================================================================================================================================================================================================================================================
  // saveCharacter

  saveCharacter() {}
}
