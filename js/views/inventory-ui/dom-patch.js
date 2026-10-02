// js/views/inventory-ui/dom-patch.js

// Redesenho das janelas sem recriar tudo: só o que mudou troca (o
// elemento sob o mouse continua o mesmo, sem piscar).

// ================================================================================================================================================================================================================================================
// patchChildren
// Deixa os filhos de target iguais aos de source reaproveitando os nós que
// já existem: troca só atributos, textos e nós de outro tipo.

export function patchChildren(target, source) {
  const next = [...source.childNodes];
  while (target.childNodes.length > next.length) target.lastChild.remove();
  next.forEach((node, i) => {
    const current = target.childNodes[i];
    if (!current) target.appendChild(node);
    else patchNode(current, node);
  });
}

// ================================================================================================================================================================================================================================================
// patchNode

function patchNode(current, node) {
  if (current.nodeType !== node.nodeType || current.nodeName !== node.nodeName) {
    current.replaceWith(node);
    return;
  }
  if (current.nodeType !== Node.ELEMENT_NODE) {
    if (current.nodeValue !== node.nodeValue) current.nodeValue = node.nodeValue;
    return;
  }
  for (const attr of [...current.attributes]) {
    if (!node.hasAttribute(attr.name) && attr.name !== 'data-fade-bound') current.removeAttribute(attr.name);
  }
  for (const attr of [...node.attributes]) {
    const value = attr.name === 'class' ? keepTransientClasses(current, attr.value) : attr.value;
    if (current.getAttribute(attr.name) !== value) current.setAttribute(attr.name, value);
  }
  patchChildren(current, node);
}

// ================================================================================================================================================================================================================================================
// keepTransientClasses
// As marcas do arrastar (onde o item pode ir, onde ele está por cima) vivem
// só na tela: o redesenho não as tira, senão elas piscam a cada atualização.

const TRANSIENT_CLASSES = ['can-drop', 'over', 'reject', 'source'];

function keepTransientClasses(current, value) {
  const kept = TRANSIENT_CLASSES.filter(name => current.classList.contains(name) && !value.split(' ').includes(name));
  return kept.length ? `${value} ${kept.join(' ')}` : value;
}
