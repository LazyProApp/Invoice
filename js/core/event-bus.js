/**
 * EventBus Module
 * Central event communication system
 */

const isBrowser = typeof window !== 'undefined';
const hasProcess = typeof process !== 'undefined' && process?.env;
const isDev = hasProcess && process.env.NODE_ENV === 'development';
const debugFlag =
  isBrowser && new URLSearchParams(window.location.search).has('debug');

export class EventBus {
  constructor() {
    this.listeners = new Map();
    this.monitorLog = [];
    this.monitoring = isDev || debugFlag;
    this.MAX_LOG_SIZE = 1000;
  }

  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(handler);

    return () => this.off(event, handler);
  }

  once(event, handler) {
    const wrapper = (data) => {
      this.off(event, wrapper);
      handler(data);
    };
    return this.on(event, wrapper);
  }

  off(event, handler) {
    this.listeners.get(event)?.delete(handler);
  }

  emit(event, data = {}) {
    if (this.monitoring) {
      if (this.monitorLog.length >= this.MAX_LOG_SIZE) {
        this.monitorLog.shift();
      }

      this.monitorLog.push({
        timestamp: Date.now(),
        event,
        data
      });
    }

    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
        }
      });
    }
  }

  enableMonitoring() {
    this.monitoring = true;
    this.monitorLog = [];
  }

  disableMonitoring() {
    this.monitoring = false;
  }

  getEventFlow() {
    return this.monitorLog.map((e) => e.event).join(' → ');
  }

  getFullLog() {
    return [...this.monitorLog];
  }

  clearLog() {
    this.monitorLog = [];
  }

  destroy() {
    this.listeners.clear();
    this.monitorLog.length = 0;
    this.monitoring = false;
  }
}
