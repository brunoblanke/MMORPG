// js/services/level-loader.js

import { loadMapDataFromURL, getMapSpawn } from '../../shared/map-format.js';
import { generateObjects, generateEnemies } from '../models/game-object.js';

export class LevelLoader {
  constructor() {
    this.mapData = null;
    this.objects = [];
    this.enemies = [];
  }

  // ================================================================================================================================================================================================================================================
  // loadFromURL

  async loadFromURL(url) {
    this.mapData = await loadMapDataFromURL(url);
    this.objects = generateObjects(this.mapData);
    this.enemies = generateEnemies(this.mapData);
    return { objects: this.objects, enemies: this.enemies };
  }

  // ================================================================================================================================================================================================================================================
  // getObjects

  getObjects() {
    return this.objects;
  }

  // ================================================================================================================================================================================================================================================
  // getEnemies

  getEnemies() {
    return this.enemies;
  }

  // ================================================================================================================================================================================================================================================
  // getSpawn

  getSpawn(fallback) {
    return getMapSpawn(this.mapData || {}, fallback);
  }
}