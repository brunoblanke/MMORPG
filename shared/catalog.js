// shared/catalog.js

export const FLOOR1_FILES = {
  'a':'floor/floor-1/Piso-1a.png','b':'floor/floor-1/Piso-1b.png','c':'floor/floor-1/Piso-1c.png','d':'floor/floor-1/Piso-1d.png',
  'e':'floor/floor-1/Piso-1e.png','f':'floor/floor-1/Piso-1f.png','g':'floor/floor-1/Piso-1g.png','h':'floor/floor-1/Piso-1h.png',
  'int-nl':'floor/floor-1/Piso1-int-nl.png','int-no':'floor/floor-1/Piso1-int-no.png','int-sl':'floor/floor-1/Piso1-int-sl.png','int-so':'floor/floor-1/Piso1-int-so.png',
  'l':'floor/floor-1/Piso1-l.png','n':'floor/floor-1/Piso1-n.png','nl':'floor/floor-1/Piso1-nl.png','no':'floor/floor-1/Piso1-no.png',
  'o':'floor/floor-1/Piso1-o.png','s':'floor/floor-1/Piso1-s.png','sl':'floor/floor-1/Piso1-sl.png','so':'floor/floor-1/Piso1-so.png'
};

export const FLOOR2_FILES = {
  'a':'floor/floor-2/Piso-2a.png','b':'floor/floor-2/Piso-2b.png','c':'floor/floor-2/Piso-2c.png','d':'floor/floor-2/Piso-2d.png',
  'int-nl':'floor/floor-2/Piso2-int-nl.png','int-no':'floor/floor-2/Piso2-int-no.png','int-sl':'floor/floor-2/Piso2-int-sl.png','int-so':'floor/floor-2/Piso2-int-so.png',
  'l':'floor/floor-2/Piso2-l.png','n':'floor/floor-2/Piso2-n.png','nl':'floor/floor-2/Piso2-nl.png','no':'floor/floor-2/Piso2-no.png',
  'o':'floor/floor-2/Piso2-o.png','s':'floor/floor-2/Piso2-s.png','sl':'floor/floor-2/Piso2-sl.png','so':'floor/floor-2/Piso2-so.png'
};

export const OBJECT_DEFS = {
  'Wall-X':  { file:'Parede-X.png', label:'Parede X',  frameW:64, frameH:64, frames:4 },
  'Wall-Y':  { file:'Parede-Y.png', label:'Parede Y',  frameW:64, frameH:64, frames:4 },
  'Wall-XY': { file:'Parede-XY.png', label:'Parede XY', frameW:64, frameH:64, frames:4 },
  'Wall-YX': { file:'Parede-YX.png', label:'Parede YX', frameW:64, frameH:64, frames:4 },
  'Stairs':  { file:'Escada.png',   label:'Escada',    frameW:64, frameH:64, frames:1 },
  'Hole':    { file:'Buraco.png',   label:'Buraco',    frameW:32, frameH:32, frames:1 }
};

export const ITEM_CATALOG = {
  'Parcel':                   { file:'Parcel.png',                   label:'Caixa (empilhável)',      frames:1,  movable:true,  hasVolume:true,  blocksMovement:false, stackable:true },
  'Bench-Left':                { file:'Banco-Esq.png',                 label:'Banco esquerdo',          frames:1,  movable:false, hasVolume:true,  blocksMovement:false, stackable:false },
  'Bench-Right':                { file:'Banco-Dir.png',                 label:'Banco direito',           frames:1,  movable:false, hasVolume:true,  blocksMovement:false, stackable:false },
  'Golden_Warlord_Sword':      { file:'Golden_Warlord_Sword.png',      label:'Espada Golden Warlord',   frames:14, movable:true,  hasVolume:false, blocksMovement:false, stackable:false },
  'Fire_Sword':                { file:'Fire_Sword.png',                label:'Espada de Fogo',          frames:2,  movable:true,  hasVolume:false, blocksMovement:false, stackable:false },
  'Incredible_Mumpiz_Slayer':  { file:'Incredible_Mumpiz_Slayer.png',  label:'Mumpiz Slayer',           frames:4,  movable:true,  hasVolume:false, blocksMovement:false, stackable:false },
  'Moonsilver_Claymore':       { file:'Moonsilver_Claymore.png',       label:'Moonsilver Claymore',     frames:12, movable:true,  hasVolume:false, blocksMovement:false, stackable:false },
  'Moonsilver_Epee':           { file:'Moonsilver_Epee.png',           label:'Moonsilver Epee',         frames:12, movable:true,  hasVolume:false, blocksMovement:false, stackable:false }
};

// Tudo que é visual vem do TIPO da criatura; o lvl só define atributos.
// file: sprite sheet (1ª linha = virada pro sul, 1ª coluna = parada), com
// quadros de spriteSize×spriteSize. corpse: sprite do cadáver (corpseSize).
export const CREATURE_TYPES = {
  'Cave Rat': { color:'#8B6B4A', defaultLvl:5,  spriteSize:32, file:'Cave-Rat.png', corpse:'Dead-Rat.png',    corpseSize:32 },
  'Dragon':   { color:'#c0392b', defaultLvl:20, spriteSize:64, file:'Dragon.png',   corpse:'Dead-Dragon.png', corpseSize:64 },
  'Demon':    { color:'#4a0e0e', defaultLvl:45, spriteSize:64, file:'Demon.png',    corpse:'Dead-Demon.png',  corpseSize:64 }
};

export const DEFAULT_CREATURE = 'Cave Rat';

// ================================================================================================================================================================================================================================================
// getCreatureType

export function getCreatureType(name) {
  return CREATURE_TYPES[name] || CREATURE_TYPES[DEFAULT_CREATURE];
}

export const PLAYER_SPRITE = { file:'Player.png', frameSize:64 };

// Sprite do player por gênero (mesma grade do Player.png: 64×64, 4 direções).
export const PLAYER_SPRITES = { male:'Player.png', female:'Player-Female.png' };
export const PLAYER_GENDERS = ['male', 'female'];
export const DEFAULT_GENDER = 'male';