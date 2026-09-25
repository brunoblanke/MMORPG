// gerador/app/js/main.js

import { fetchCatalog } from './api.js';
import { initPicker } from './picker.js';
import { initFloors, pickSprite, useAllVariations } from './floors.js';

// Gerador de sprites: carrega o catálogo do Tibia e abre a folha de pisos.

// ================================================================================================================================================================================================================================================
// boot

async function boot() {
  initFloors();
  try {
    const catalog = await fetchCatalog();
    initPicker(catalog.items, { onPick: pickSprite, onUseAll: useAllVariations });
  } catch (error) {
    document.getElementById('pickerGrid').textContent = `Não deu pra ler os sprites do Tibia: ${error.message}`;
  }
}

boot();
