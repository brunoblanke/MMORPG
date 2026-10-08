// editor/js/view/sprite-thumb.js

import { getAsset, splitType, spriteFrame, WALL_PIECES } from '../../../shared/assets.js';

// Miniatura de uma peça de folha do gerador num elemento (fundo em CSS):
// recorta a peça e amplia/reduz pro tamanho pedido.

// ================================================================================================================================================================================================================================================
// sheetSize
// Largura e altura da folha inteira, pelo formato de cada ferramenta (objeto
// que gira: uma linha por direção).

function sheetSize(asset) {
  const size = asset.quadro;
  if (asset.ferramenta === 'pisos') return [4 * Math.max(1, asset.quadros || 1) * size, (4 + (asset.padrao ? asset.padrao[1] : 0)) * size];
  if (asset.ferramenta === 'paredes') return [4 * size, Math.ceil((asset.ordem || WALL_PIECES).length / 4) * size];
  if (asset.ferramenta === 'criaturas') return [Math.max(asset.quadros, 3) * size, 5 * size];
  return [Math.max(1, asset.quadros) * size, Math.max(1, (asset.direcoes || []).length) * size];
}

// ================================================================================================================================================================================================================================================
// setThumb
// type: folha ou '<folha>#<peça>'; size: lado da miniatura em px.

export function setThumb(el, type, size) {
  const asset = getAsset(splitType(type).asset);
  const frame = asset && (asset.ferramenta === 'criaturas' ? { url: asset.url, x: 0, y: 0, size: asset.quadro } : spriteFrame(type));
  if (!frame) return;
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.backgroundRepeat = 'no-repeat';
  el.style.imageRendering = 'pixelated';
  el.style.backgroundImage = `url(${frame.url})`;
  const [width, height] = sheetSize(asset);
  const place = (box) => {
    const scale = Math.min(size / box.w, size / box.h);
    el.style.backgroundSize = `${width * scale}px ${height * scale}px`;
    el.style.backgroundPosition = `${(size - box.w * scale) / 2 - (frame.x + box.x) * scale}px ${(size - box.h * scale) / 2 - (frame.y + box.y) * scale}px`;
  };
  place({ x: 0, y: 0, w: frame.size, h: frame.size });
  if (asset.ferramenta === 'criaturas') creatureBox(frame).then(box => box && place(box));
}

// ================================================================================================================================================================================================================================================
// creatureBox
// O retângulo que a criatura ocupa no primeiro quadro (a folha tem o tamanho da maior entre ela e os cadáveres, e ela fica no canto de baixo à direita); guarda por folha.

const boxes = new Map();

function creatureBox(frame) {
  if (!boxes.has(frame.url)) {
    boxes.set(frame.url, new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = frame.size;
        canvas.height = frame.size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, frame.size, frame.size, 0, 0, frame.size, frame.size);
        const data = ctx.getImageData(0, 0, frame.size, frame.size).data;
        let minX = frame.size, minY = frame.size, maxX = -1, maxY = -1;
        for (let y = 0; y < frame.size; y++) {
          for (let x = 0; x < frame.size; x++) {
            if (data[(y * frame.size + x) * 4 + 3] === 0) continue;
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
          }
        }
        resolve(maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 });
      };
      img.onerror = () => resolve(null);
      img.src = frame.url;
    }));
  }
  return boxes.get(frame.url);
}
