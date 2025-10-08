/**
 * StatisticsManager Module
 * Invoice statistics display and management
 */

import { Utils } from './utils.js';
import { EVENTS } from '../core/events.js';

class StatisticsManager {
  constructor(domElements, eventBus = null, dataManager = null) {
    this.dom = domElements;
    this.eventBus = eventBus;
    this.dataManager = dataManager;
    this.setupEventListeners();
  }

  setupEventListeners() {
    if (!this.eventBus) return;

    this.eventBus.on(EVENTS.DOMAIN.STATISTICS_CHANGED, (data) => {
      this.update(data);
    });

    this.eventBus.on(EVENTS.DOMAIN.INVOICE_ADDED, () => this.update());
    this.eventBus.on(EVENTS.DOMAIN.INVOICE_UPDATED, () => this.update());
    this.eventBus.on(EVENTS.DOMAIN.INVOICE_DELETED, () => this.update());
    this.eventBus.on(EVENTS.DOMAIN.DATA_IMPORTED, () => this.update());
    this.eventBus.on(EVENTS.DOMAIN.DATA_CHANGED, () => this.update());

    this.eventBus.on(EVENTS.PROCESS.ROW_SUCCESS, () => this.update());
    this.eventBus.on(EVENTS.PROCESS.ROW_FAILED, () => this.update());
    this.eventBus.on(EVENTS.PROCESS.INVOICE_VOIDED, () => this.update());
  }

  updateDisplay(statistics) {
    if (this.dom.totalCount)
      this.dom.totalCount.textContent = Utils.formatNumber(statistics.total);
    if (this.dom.successCount)
      this.dom.successCount.textContent = Utils.formatNumber(statistics.success);
    if (this.dom.failedCount)
      this.dom.failedCount.textContent = Utils.formatNumber(statistics.failed);
  }

  update(summary) {
    if (summary && typeof summary === 'object') {
      this.updateDisplay(summary);
    } else if (this.dataManager && this.dataManager.getStatistics) {
      const statistics = this.dataManager.getStatistics();
      this.updateDisplay(statistics);
    }
  }

}

export { StatisticsManager };
