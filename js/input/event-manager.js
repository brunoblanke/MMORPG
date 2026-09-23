// js/input/event-manager.js

export class EventManager {
  constructor() {
    this.listeners = {};
    this.canvasListeners = [];
  }

  // ================================================================================================================================================================================================================================================
  // on

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  // ================================================================================================================================================================================================================================================
  // off

  off(event, callback) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  // ================================================================================================================================================================================================================================================
  // emit

  emit(event, data) {
    if (!this.listeners[event]) return;
    for (const callback of this.listeners[event]) {
      callback(data);
    }
  }

  // ================================================================================================================================================================================================================================================
  // setupCanvasEvents

  setupCanvasEvents(canvas, camera) {
    const self = this;

    const clickHandler = function(e) {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const gridPos = camera.screenToGrid(mouseX, mouseY);
      self.emit('click', { mouseX, mouseY, gridPos, event: e });
    };

    const mousemoveHandler = function(e) {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      self.emit('mousemove', { mouseX, mouseY, event: e });
    };

    const mousedownHandler = function(e) {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      self.emit('mousedown', { mouseX, mouseY, event: e });
    };

    const mouseupHandler = function(e) {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      self.emit('mouseup', { mouseX, mouseY, event: e });
    };

    canvas.addEventListener('click', clickHandler);
    canvas.addEventListener('mousemove', mousemoveHandler);
    canvas.addEventListener('mousedown', mousedownHandler);
    canvas.addEventListener('mouseup', mouseupHandler);

    this.canvasListeners = [clickHandler, mousemoveHandler, mousedownHandler, mouseupHandler];
  }

  // ================================================================================================================================================================================================================================================
  // destroy

  destroy(canvas) {
    for (const listener of this.canvasListeners) {
      canvas.removeEventListener('click', listener);
      canvas.removeEventListener('mousemove', listener);
      canvas.removeEventListener('mousedown', listener);
      canvas.removeEventListener('mouseup', listener);
    }
    this.canvasListeners = [];
    this.listeners = {};
  }
}