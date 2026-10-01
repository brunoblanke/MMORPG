// shared/npcs.js

// NPCs do mapa. at: posição em relação ao spawn do mapa (sqm livre mais
// perto dali); radius: até quantos sqm dali ele passeia. welcome: o que ele diz quando um player chega perto. Com o
// player em conversa (disse uma das palavras de greet), cada tópico responde
// quando a mensagem tem uma das palavras dele; bye encerra. {nome} vira o
// nome do player.

export const NPC_DEFS = [
  {
    id: 'guia',
    name: 'Guia',
    gender: 'male',
    at: { dx: -1, dy: -1 },
    radius: 2,
    welcome: 'Bem-vindo, aventureiro!',
    greet: {
      words: ['oi', 'ola', 'oie', 'hi', 'hello', 'bom dia', 'boa tarde', 'boa noite'],
      reply: 'Olá, {nome}! Posso falar sobre andar, combate, itens, comida, poções, escadas e ferramentas.'
    },
    bye: {
      words: ['tchau', 'adeus', 'ate mais', 'bye'],
      reply: 'Até mais, {nome}. Boa aventura!'
    },
    topics: [
      { words: ['andar', 'mover', 'movimento', 'caminhar'], reply: 'Clique no chão pra andar até lá, ou use W, A, S, D (Q, E, Z e C nas diagonais).' },
      { words: ['combate', 'atacar', 'ataque', 'lutar', 'luta'], reply: 'Clique numa criatura pra atacar. No inventário, um ícone liga seguir o alvo e o outro o auto ataque.' },
      { words: ['itens', 'item', 'loot', 'mochila', 'bag'], reply: 'Arraste os itens pro inventário. Duplo clique ou botão direito abre bolsas e corpos. Shift + clique mostra o que é.' },
      { words: ['comida', 'comer', 'fome'], reply: 'Comer recupera vida e mana aos poucos. Duplo clique ou botão direito na comida.' },
      { words: ['pocoes', 'pocao', 'potion', 'potions', 'curar'], reply: 'Clique na poção e depois em você ou em outro aventureiro. Errou o alvo, o líquido cai no chão.' },
      { words: ['escadas', 'escada', 'subir', 'descer', 'bueiro'], reply: 'Escadas sobem e descem ao pisar. Bueiros e alçapões se usam com duplo clique ou botão direito.' },
      { words: ['ferramentas', 'ferramenta', 'corda', 'pa'], reply: 'Use a corda nas marcas de corda pra subir e a pá nos montes de terra pra abrir um buraco.' },
      { words: ['nome', 'quem', 'trabalho'], reply: 'Sou o Guia. Recebo os aventureiros que chegam por aqui.' }
    ]
  }
];
