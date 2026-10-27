// gerador/app/js/interacoes.js

import { fetchProjects } from './api.js';
import { CAPACIDADES, ESQUEMA_EFEITOS } from '/shared/ficha.js';
import { EFFECTS } from '/shared/effects.js';

// O painel de interações da ficha (modelo de objetos): serve igual em Objetos, Criaturas e Pisos. A lista é a da
// receita (propriedades.interacoes): cada interação é um gatilho (clicar, usar uma ferramenta com uma capacidade ou
// pisar), condições e uma lista de efeitos do vocabulário. Também escolhe as capacidades do objeto como
// ferramenta (propriedades.capacidade).

const GATILHOS_NA_TELA = [['clicar', 'Ao clicar / usar'], ['capacidade', 'Ao usar uma ferramenta com a capacidade'], ['pisar', 'Ao pisar'], ['item-em-cima', 'Ao jogar um item em cima'], ['falar', 'Ao ouvir o player falar'], ['ser-atingido', 'Ao ser atingido (criatura)'], ['morrer', 'Ao morrer (criatura)'], ['tempo', 'A cada segundo (criatura)']];
const NOMES_CAPACIDADES = { cavar: 'Cavar', quebrar: 'Quebrar', cortar: 'Cortar', colher: 'Colher', puxar: 'Puxar (corda)', pescar: 'Pescar', abrir: 'Abrir com chave', lenhar: 'Lenhar (machado)' };

let itensCache = null;

// ================================================================================================================================================================================================================================================
// carregarItens
// Os itens do gerador (pra escolher em "Soltar item" e "Dar item").

async function carregarItens() {
  if (itensCache) return itensCache;
  try {
    const projetos = await fetchProjects();
    itensCache = projetos.filter(p => p.ferramenta === 'objetos' && p.grupo === 'itens').map(p => p.caminho).sort();
  } catch {
    itensCache = [];
  }
  return itensCache;
}

// ================================================================================================================================================================================================================================================
// criar
// el, props, opcoes -> o elemento, com os campos e os handlers.

function criar(tag, props = {}, ...filhos) {
  const el = document.createElement(tag);
  Object.assign(el, props);
  el.append(...filhos);
  return el;
}

// ================================================================================================================================================================================================================================================
// campoDoEfeito
// Um campo do efeito, pelo tipo dele no esquema.

function campoDoEfeito(efeito, campo, itens, mudou) {
  let entrada;
  if (campo.tipo === 'numero') {
    entrada = criar('input', { type: 'number', min: 0, step: 1, value: efeito[campo.chave] ?? 0, className: 'ix-num' });
    entrada.oninput = () => { efeito[campo.chave] = Math.max(0, Math.floor(Number(entrada.value)) || 0); mudou(); };
  } else if (campo.tipo === 'escolha' || campo.tipo === 'item' || campo.tipo === 'efeito') {
    const opcoes = campo.tipo === 'escolha' ? campo.opcoes : campo.tipo === 'efeito' ? Object.keys(EFFECTS) : itens;
    const atual = efeito[campo.chave] ?? (campo.tipo === 'escolha' ? campo.opcoes[0] : '');
    const lista = atual && !opcoes.includes(atual) ? [atual, ...opcoes] : opcoes;
    entrada = criar('select');
    entrada.innerHTML = (campo.tipo === 'escolha' ? '' : '<option value="">— escolha —</option>') + lista.map(v => `<option value="${v}">${campo.tipo === 'item' ? v.replace(/^itens\//, '') : v}</option>`).join('');
    entrada.value = atual;
    efeito[campo.chave] = entrada.value;
    entrada.onchange = () => { efeito[campo.chave] = entrada.value; mudou(); };
  } else if (campo.tipo === 'destino') {
    const d = efeito[campo.chave] || (efeito[campo.chave] = { x: '', y: '', z: 0 });
    entrada = criar('span', { className: 'ix-dest' });
    for (const eixo of ['x', 'y', 'z']) {
      const caixa = criar('input', { type: 'number', step: 1, placeholder: eixo === 'z' ? 'andar' : eixo, value: d[eixo] ?? '', className: 'ix-num' });
      caixa.oninput = () => { d[eixo] = caixa.value === '' ? '' : Math.floor(Number(caixa.value)); mudou(); };
      entrada.append(caixa);
    }
  } else {
    entrada = criar('input', { type: 'text', maxLength: 200, value: efeito[campo.chave] ?? '', className: 'ix-text' });
    entrada.oninput = () => { efeito[campo.chave] = entrada.value; mudou(); };
  }
  return criar('label', { className: 'ix-field' }, criar('span', { textContent: campo.rotulo }), entrada);
}

// ================================================================================================================================================================================================================================================
// montarInteracoes
// Desenha a lista no `box`. `lista` é o array da receita (muda no lugar); aoMudar avisa que há algo a salvar.

export async function montarInteracoes(box, lista, aoMudar) {
  const itens = await carregarItens();
  const mudou = () => aoMudar();
  const desenhar = () => {
    box.innerHTML = '';
    lista.forEach((ix, i) => {
      const cartao = criar('div', { className: 'ix-card' });
      const topo = criar('div', { className: 'ix-row' });
      const gatilho = criar('select');
      gatilho.innerHTML = GATILHOS_NA_TELA.map(([v, t]) => `<option value="${v}">${t}</option>`).join('');
      gatilho.value = (ix.gatilho && ix.gatilho.tipo) || 'clicar';
      gatilho.onchange = () => { ix.gatilho = { tipo: gatilho.value, ...(gatilho.value === 'capacidade' ? { capacidade: CAPACIDADES[0] } : {}) }; mudou(); desenhar(); };
      topo.append(gatilho);
      if (ix.gatilho.tipo === 'capacidade') {
        const cap = criar('select');
        cap.innerHTML = CAPACIDADES.map(c => `<option value="${c}">${NOMES_CAPACIDADES[c]}</option>`).join('');
        cap.value = ix.gatilho.capacidade;
        cap.onchange = () => { ix.gatilho.capacidade = cap.value; mudou(); };
        topo.append(cap);
      }
      const remover = criar('button', { type: 'button', className: 'ghost-btn', textContent: '× interação' });
      remover.onclick = () => { lista.splice(i, 1); mudou(); desenhar(); };
      topo.append(remover);
      cartao.append(topo);

      ix.condicoes = ix.condicoes || {};
      const condicoes = criar('div', { className: 'ix-row' });
      for (const [chave, rotulo, tipo] of [['alcance', 'Alcance (sqm)', 'numero'], ['nivel', 'Nível mínimo', 'numero'], ['chance', 'Chance %', 'numero'], ['vezes', 'A cada N vezes', 'numero'], ['idade', 'Depois de (s no lugar)', 'numero'], ['quest', 'Quest feita', 'texto'], ['palavra', 'Palavra dita', 'texto'], ['item', 'Item colocado (parte do nome)', 'texto']]) {
        const entrada = criar('input', { type: tipo === 'numero' ? 'number' : 'text', value: ix.condicoes[chave] ?? '', className: tipo === 'numero' ? 'ix-num' : 'ix-text', placeholder: 'sem' });
        entrada.oninput = () => {
          const v = tipo === 'numero' ? (entrada.value === '' ? undefined : Math.max(0, Math.floor(Number(entrada.value)) || 0)) : entrada.value.trim();
          if (v === undefined || v === '') delete ix.condicoes[chave]; else ix.condicoes[chave] = v;
          mudou();
        };
        condicoes.append(criar('label', { className: 'ix-field' }, criar('span', { textContent: rotulo }), entrada));
      }
      cartao.append(condicoes);

      ix.efeitos = ix.efeitos || [];
      ix.efeitos.forEach((efeito, j) => {
        const linha = criar('div', { className: 'ix-row ix-effect' });
        const tipo = criar('select');
        tipo.innerHTML = Object.entries(ESQUEMA_EFEITOS).map(([v, e]) => `<option value="${v}">${e.rotulo}</option>`).join('');
        tipo.value = efeito.tipo;
        tipo.onchange = () => { ix.efeitos[j] = { tipo: tipo.value }; mudou(); desenhar(); };
        linha.append(tipo);
        for (const campo of ESQUEMA_EFEITOS[efeito.tipo].campos) linha.append(campoDoEfeito(efeito, campo, itens, mudou));
        const tirar = criar('button', { type: 'button', className: 'ghost-btn', textContent: '×' });
        tirar.onclick = () => { ix.efeitos.splice(j, 1); mudou(); desenhar(); };
        linha.append(tirar);
        cartao.append(linha);
      });
      const mais = criar('button', { type: 'button', className: 'ghost-btn', textContent: '+ Efeito' });
      mais.onclick = () => { ix.efeitos.push({ tipo: 'falar', texto: '' }); mudou(); desenhar(); };
      cartao.append(mais);
      box.append(cartao);
    });
    const nova = criar('button', { type: 'button', className: 'ghost-btn', textContent: '+ Interação' });
    nova.onclick = () => { lista.push({ gatilho: { tipo: 'clicar' }, condicoes: { alcance: 1 }, efeitos: [{ tipo: 'falar', texto: '' }] }); mudou(); desenhar(); };
    box.append(nova);
  };
  desenhar();
}

// ================================================================================================================================================================================================================================================
// montarCapacidades
// As capacidades do objeto como ferramenta: marcadas, a ferramenta usada com a mira faz essa capacidade no alvo.

export function montarCapacidades(box, lista, aoMudar) {
  box.innerHTML = '';
  for (const capacidade of CAPACIDADES) {
    const caixa = criar('input', { type: 'checkbox', checked: lista.includes(capacidade) });
    caixa.onchange = () => {
      const pos = lista.indexOf(capacidade);
      if (caixa.checked && pos < 0) lista.push(capacidade);
      if (!caixa.checked && pos >= 0) lista.splice(pos, 1);
      aoMudar();
    };
    box.append(criar('label', { className: 'checkline' }, caixa, NOMES_CAPACIDADES[capacidade]));
  }
}
