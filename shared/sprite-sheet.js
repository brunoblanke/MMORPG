// shared/sprite-sheet.js

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

// origin: onde a grade de quadros começa na imagem (peça de uma folha maior).

export class SpriteSheet {
  constructor(imageSrc, frameWidth, frameHeight, totalFrames, directions, origin = { x: 0, y: 0 }) {
    this.image = new Image();
    this.image.src = imageSrc;
    this.frameWidth = frameWidth;
    this.frameHeight = frameHeight;
    this.totalFrames = totalFrames;
    this.directions = directions;
    this.origin = origin;
  }

  // ================================================================================================================================================================================================================================================
  // getFrameRect

  getFrameRect(direction, timestamp, durationPerFrame) {
    const rect = pickFrameRect(this.directions, this.frameWidth, this.frameHeight, this.totalFrames, direction, timestamp, durationPerFrame);
    return { ...rect, sx: rect.sx + this.origin.x, sy: rect.sy + this.origin.y };
  }

  // ================================================================================================================================================================================================================================================
  // getIdleRect

  getIdleRect(direction) {
    const dirIndex = this.directions.indexOf(direction);
    if (dirIndex === -1) {
      return this.getIdleRect(this.directions[0]);
    }
    return {
      sx: this.origin.x,
      sy: this.origin.y + dirIndex * this.frameHeight,
      sw: this.frameWidth,
      sh: this.frameHeight
    };
  }
}
