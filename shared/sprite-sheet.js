// shared/sprite-sheet.js

// Quadros de caminhada das folhas do Tibia 7.80 (a base da velocidade da animação).
const WALK_BASE_FRAMES = 2;

// ================================================================================================================================================================================================================================================
// pickFrameRect

export function pickFrameRect(directions, frameWidth, frameHeight, totalFrames, direction, timestamp, durationPerFrame) {
  const dirIndex = directions.indexOf(direction);
  if (dirIndex === -1) {
    return pickFrameRect(directions, frameWidth, frameHeight, totalFrames, directions[0], timestamp, durationPerFrame);
  }

  if (totalFrames <= 1) {
    return {
      sx: 0,
      sy: dirIndex * frameHeight,
      sw: frameWidth,
      sh: frameHeight
    };
  }

  const duration = durationPerFrame || 100;
  const cycleDuration = totalFrames * duration;
  const elapsed = timestamp % cycleDuration;
  const frameIndex = Math.floor(elapsed / duration);

  return {
    sx: frameIndex * frameWidth,
    sy: dirIndex * frameHeight,
    sw: frameWidth,
    sh: frameHeight
  };
}

// origin: onde a grade de quadros começa na imagem (peça de uma folha maior). scale: a imagem é scale vezes maior
// que o tamanho do jogo (folha desenhada por código, nítida): os retângulos saem em pixels da imagem (sx, sy, sw, sh)
// com o tamanho de desenhar na tela em dw e dh.

export class SpriteSheet {
  constructor(imageSrc, frameWidth, frameHeight, totalFrames, directions, origin = { x: 0, y: 0 }, scale = 1) {
    this.image = new Image();
    this.image.src = imageSrc;
    this.frameWidth = frameWidth;
    this.frameHeight = frameHeight;
    this.totalFrames = totalFrames;
    this.directions = directions;
    this.origin = origin;
    this.scale = scale;
  }

  // ================================================================================================================================================================================================================================================
  // scaled
  // O retângulo (em tamanho do jogo) nos pixels da imagem, com dw e dh.

  scaled(rect) {
    const k = this.scale || 1;
    return k === 1 ? rect : { ...rect, sx: rect.sx * k, sy: rect.sy * k, sw: rect.sw * k, sh: rect.sh * k, dw: rect.sw, dh: rect.sh };
  }

  // ================================================================================================================================================================================================================================================
  // getFrameRect

  getFrameRect(direction, timestamp, durationPerFrame) {
    const rect = pickFrameRect(this.directions, this.frameWidth, this.frameHeight, this.totalFrames, direction, timestamp, durationPerFrame);
    return this.scaled({ ...rect, sx: rect.sx + this.origin.x, sy: rect.sy + this.origin.y });
  }

  // ================================================================================================================================================================================================================================================
  // getWalkRect
  // Andando: só os quadros de caminhada (do 2º em diante); o 1º, parado, fica
  // pra quando a criatura realmente para. durationPerFrame é o tempo de um
  // quadro numa caminhada de 2 quadros: com mais quadros (Tibia atual: 8),
  // cada um dura menos e a volta inteira leva o mesmo tempo.

  getWalkRect(direction, timestamp, durationPerFrame) {
    if (this.totalFrames <= 1) return this.getIdleRect(direction);
    const walkFrames = this.totalFrames - 1;
    const duration = (durationPerFrame || 100) * Math.min(1, WALK_BASE_FRAMES / walkFrames);
    const frameIndex = 1 + Math.floor((timestamp % (walkFrames * duration)) / duration);
    const idle = this.getIdleRect(direction);
    return { ...idle, sx: idle.sx + frameIndex * this.frameWidth * (this.scale || 1) };
  }

  // ================================================================================================================================================================================================================================================
  // getIdleRect

  getIdleRect(direction) {
    const dirIndex = this.directions.indexOf(direction);
    if (dirIndex === -1) {
      return this.getIdleRect(this.directions[0]);
    }
    return this.scaled({
      sx: this.origin.x,
      sy: this.origin.y + dirIndex * this.frameHeight,
      sw: this.frameWidth,
      sh: this.frameHeight
    });
  }
}
