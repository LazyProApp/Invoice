/**
 * DataEngine Module
 * Central data management and persistence
 */
import { EVENTS } from './events.js';

export class DataEngine {
  constructor(eventBus = null) {
    this.eventBus = eventBus;
    this.invoices = new Map();
    this.metadata = new Map();
    this.invoiceOrder = [];

    this.config = {
      maxInvoices: 5000,
      maxCacheSize: 100,
      pageSize: 100,
      cacheExpireTime: 10 * 60 * 1000,
      cleanupInterval: 5 * 60 * 1000
    };

    this.jsonCache = new Map();
    this.cacheMetadata = new Map();
    this.lastCleanup = Date.now();
    this.isDestroyed = false;

    this.sources = {
      UPLOADED: 'uploaded',
      CREATED: 'created',
      DEMO: 'demo',
      LEGACY: 'legacy'
    };

    this.appState = {
      isProcessing: false,
      hasUploadedFile: false,
      isTestMode: false,
      uploadSession: null,
      currentPlatform: null,
      editIndex: null,
      selectedInvoices: new Set(),
      demoInvoicesData: null
    };

    this.platformConfigs = {};
    this.carrierProviders = new Map();

    this.setupEventListeners();
    this.startPeriodicCleanup();
    this.initializeOrder();
  }

  setupEventListeners() {
    this.eventBus.on(EVENTS.APP_EVENTS.PLATFORM_CHANGED, (data) => {
      this.appState.currentPlatform = data.platform;
    });

    this.eventBus.on(EVENTS.PLATFORM.CREDENTIALS_LOADED, (data) => {
      this.handleCredentialsLoaded(data);
    });
  }

  getState(key) {
    return key ? this.appState[key] : this.appState;
  }

  setState(key, value) {
    const oldValue = this.appState[key];
    this.appState[key] = value;

    return { key, value, oldValue, timestamp: Date.now() };
  }

  setUploadSession(session) {
    this.setState('uploadSession', session);
    this.setState('hasUploadedFile', !!session);
  }

  clearUploadSession() {
    this.setState('uploadSession', null);
    this.setState('hasUploadedFile', false);
  }

  getUploadSession() {
    return this.getState('uploadSession');
  }

  hasUploadSession() {
    return (
      Boolean(sessionStorage.getItem('uploadSession')) ||
      Boolean(this.getState('uploadSession'))
    );
  }

  clear() {
    this.invoices.clear();
    this.metadata.clear();
    this.invoiceOrder = [];
    this.jsonCache.clear();
    this.cacheMetadata.clear();
  }

  addInvoice(
    orderNo,
    data,
    source = this.sources.CREATED,
    originalOrderNo = null,
    options = {}
  ) {
    let resolvedOrderNo = orderNo;
    if (this.invoices.has(resolvedOrderNo)) {
      resolvedOrderNo = this.generateUniqueOrderNo(resolvedOrderNo);
    }

    const invoiceData = {
      ...data,
      merchant_order_no: resolvedOrderNo,
      _status: data._status || 'pending'
    };

    if (!invoiceData.provider && this.appState.currentPlatform) {
      invoiceData.provider = this.appState.currentPlatform;
    }
    invoiceData.carrier_text = this.resolveCarrierText(invoiceData);

    this.invoices.set(resolvedOrderNo, invoiceData);
    this.metadata.set(resolvedOrderNo, {
      source,
      createdAt: Date.now(),
      lastModified: Date.now()
    });

    this.insertIntoOrder(resolvedOrderNo, options);

    this.checkInvoiceLimit();

    if (this.eventBus) {
      this.eventBus.emit(EVENTS.DOMAIN.INVOICE_ADDED, {
        id: resolvedOrderNo,
        data: invoiceData,
        source,
        originalOrderNo,
        position: options.position,
        afterId: options.afterId,
        timestamp: new Date().toISOString()
      });
    }

    this.emitDataChanged('add', { id: resolvedOrderNo });

    return { success: true, orderNo: resolvedOrderNo };
  }

  updateInvoice(orderNo, data) {
    const existingInvoice = this.invoices.get(orderNo);
    const updatedData = {
      ...existingInvoice,
      ...data,
      merchant_order_no: orderNo
    };

    if (!updatedData.provider && this.appState.currentPlatform) {
      updatedData.provider = this.appState.currentPlatform;
    }
    updatedData.carrier_text = this.resolveCarrierText(updatedData);

    this.invoices.set(orderNo, updatedData);

    const meta = this.metadata.get(orderNo);
    if (meta) {
      meta.lastModified = Date.now();
    }

    if (this.eventBus) {
      this.eventBus.emit(EVENTS.DOMAIN.INVOICE_UPDATED, {
        id: orderNo,
        data: updatedData,
        timestamp: new Date().toISOString()
      });
    }

    this.emitDataChanged('update', { id: orderNo });

    return { success: true };
  }

  updateInvoiceStatus(orderNo, status, additionalData = {}) {
    const invoice = this.invoices.get(orderNo);

    invoice._status = status;

    Object.keys(additionalData).forEach((key) => {
      invoice[key] = additionalData[key];
    });

    if (!invoice.provider && this.appState.currentPlatform) {
      invoice.provider = this.appState.currentPlatform;
    }
    invoice.carrier_text = this.resolveCarrierText(invoice);

    const meta = this.metadata.get(orderNo);
    if (meta) {
      meta.lastModified = Date.now();
    }

    if (this.eventBus) {
      this.eventBus.emit(EVENTS.DOMAIN.INVOICE_UPDATED, {
        id: orderNo,
        data: invoice,
        timestamp: new Date().toISOString()
      });
    }

    this.emitDataChanged('status_update', { id: orderNo, status });
  }

  deleteInvoice(orderNo) {
    if (!this.invoices.has(orderNo)) {
      return { success: false, error: 'Invoice not found' };
    }

    const deletedInvoice = this.invoices.get(orderNo);
    this.invoices.delete(orderNo);
    this.metadata.delete(orderNo);

    const index = this.invoiceOrder.indexOf(orderNo);
    if (index !== -1) {
      this.invoiceOrder.splice(index, 1);
    }

    if (this.eventBus) {
      this.eventBus.emit(EVENTS.DOMAIN.INVOICE_DELETED, {
        id: orderNo,
        deletedData: deletedInvoice,
        timestamp: new Date().toISOString()
      });
    }

    this.emitDataChanged('delete', { id: orderNo });

    return { success: true };
  }

  getInvoice(orderNo) {
    return this.invoices.get(orderNo) || null;
  }

  getAllInvoices() {
    return this.invoiceOrder
      .map((orderNo) => {
        const invoice = this.invoices.get(orderNo);
        if (!invoice) {
          return null;
        }

        const meta = this.metadata.get(orderNo) || {};
        return {
          orderNo,
          ...invoice,
          carrier_text: this.resolveCarrierText(invoice),
          source: meta.source,
          createdAt: meta.createdAt,
          lastModified: meta.lastModified
        };
      })
      .filter(Boolean);
  }

  getInvoicesBySource(source = null) {
    const invoices = [];

    this.invoices.forEach((invoice, orderNo) => {
      const metadata = this.metadata.get(orderNo);
      if (!source || metadata?.source === source) {
        invoices.push({
          ...invoice,
          _metadata: metadata
        });
      }
    });

    return invoices;
  }

  hasInvoice(orderNo) {
    return this.invoices.has(orderNo);
  }

  getInvoiceCount() {
    return this.invoices.size;
  }

  clearAllInvoices() {
    const previousCount = this.invoices.size;
    this.invoices.clear();
    this.metadata.clear();
    this.invoiceOrder = [];

    this.emitDataChanged('clear', { previousCount });

    return { success: true, previousCount };
  }

  setInvoices(invoices) {
    const previousCount = this.invoices.size;
    this.invoices.clear();
    this.metadata.clear();
    this.invoiceOrder = [];

    const results = { successful: [], failed: [] };
    invoices.forEach((invoice, index) => {
      let currentOrderNo = invoice.merchant_order_no || this.generateOrderNo();

      if (this.invoices.has(currentOrderNo)) {
        currentOrderNo = this.generateUniqueOrderNo(currentOrderNo);
      }

      const invoiceData = {
        ...invoice,
        merchant_order_no: currentOrderNo,
        _status: 'pending'
      };

      if (!invoiceData.provider && this.appState.currentPlatform) {
        invoiceData.provider = this.appState.currentPlatform;
      }
      invoiceData.carrier_text = this.resolveCarrierText(invoiceData);
      this.invoices.set(currentOrderNo, invoiceData);

      this.metadata.set(currentOrderNo, {
        source: 'uploaded',
        createdAt: Date.now(),
        lastModified: Date.now()
      });

      this.invoiceOrder.push(currentOrderNo);

      results.successful.push({ ...invoiceData, _index: index + 1 });
    });

    this.checkInvoiceLimit();

    if (this.eventBus) {
      this.eventBus.emit(EVENTS.DOMAIN.DATA_IMPORTED, {
        results,
        source: 'file_upload',
        replaceMode: true,
        previousCount,
        currentCount: results.successful.length,
        timestamp: new Date().toISOString()
      });
    }

    this.emitDataChanged('import', {
      previousCount,
      currentCount: results.successful.length,
      successCount: results.successful.length,
      failedCount: results.failed.length
    });

    return { success: true, results };
  }

  storePlatformConfig(config) {
    if (config && config.provider) {
      this.platformConfigs[config.provider] = this.deepClone(config);
    }
  }

  async getPlatformConfig(provider) {
    const config = this.platformConfigs[provider];

    return config;
  }

  getCurrentPlatform() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlPlatform = urlParams.get('platform');
    if (urlPlatform) {
      return urlPlatform.toLowerCase();
    }

    const storedPlatform = localStorage.getItem('selectedPlatform');
    if (storedPlatform) {
      return storedPlatform.toLowerCase();
    }

    if (this.appState.currentPlatform) {
      return this.appState.currentPlatform;
    }

    return null;
  }

  getVisibleInvoices() {
    return this.getAllInvoices();
  }

  getStatistics() {
    const visibleInvoices = this.getVisibleInvoices();

    return {
      total: visibleInvoices.length,
      success: visibleInvoices.filter(
        (inv) => inv._status === 'success' || inv._status === 'demo'
      ).length,
      failed: visibleInvoices.filter((inv) => inv._status === 'failed').length,
      pending: visibleInvoices.filter(
        (inv) => !inv._status || inv._status === 'pending'
      ).length,
      bySource: {
        uploaded: visibleInvoices.filter((inv) => inv.source === 'uploaded')
          .length,
        created: visibleInvoices.filter((inv) => inv.source === 'created')
          .length,
        demo: visibleInvoices.filter((inv) => inv.source === 'demo').length,
        legacy: visibleInvoices.filter((inv) => inv.source === 'legacy').length
      },
      byCategory: {
        B2B: visibleInvoices.filter((inv) => inv.category === 'B2B').length,
        B2C: visibleInvoices.filter((inv) => inv.category === 'B2C').length
      }
    };
  }

  getStatisticsSummary() {
    const stats = this.getStatistics();
    return {
      total: stats.total,
      success: stats.success,
      failed: stats.failed,
      pending: stats.pending,
      successRate:
        stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0
    };
  }

  generateUniqueOrderNo(base) {
    let counter = 1;
    let newOrderNo = `${base}_${counter}`;

    while (this.invoices.has(newOrderNo)) {
      counter++;
      newOrderNo = `${base}_${counter}`;
    }

    return newOrderNo;
  }

  generateOrderNo() {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let random = '';
    for (let i = 0; i < 6; i++) {
      random += chars[Math.floor(Math.random() * 36)];
    }
    return `LAZYINVOICE888${random}`;
  }

  validateField(fieldName, value, rules) {
    if (rules.required && !value) {
      return { valid: false, error: '請填寫此欄' };
    }

    if (rules.pattern && !new RegExp(rules.pattern).test(value)) {
      return { valid: false, error: '格式不正確' };
    }

    if (rules.minLength && value.length < rules.minLength) {
      return { valid: false, error: `最少需要 ${rules.minLength} 個字元` };
    }

    if (rules.maxLength && value.length > rules.maxLength) {
      return { valid: false, error: `最多只能 ${rules.maxLength} 個字元` };
    }

    return { valid: true, error: '' };
  }

  deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime());
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.deepClone(item));
    }

    const cloned = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = this.deepClone(obj[key]);
      }
    }

    return cloned;
  }

  trackCacheAccess(key) {
    const metadata = this.cacheMetadata.get(key) || {
      accessCount: 0,
      lastAccess: 0
    };
    metadata.accessCount++;
    metadata.lastAccess = Date.now();
    this.cacheMetadata.set(key, metadata);
  }

  cleanupExpiredCache() {
    const now = Date.now();
    const expireTime = this.config.cacheExpireTime;

    for (const [key] of this.jsonCache.entries()) {
      const metadata = this.cacheMetadata.get(key);
      if (metadata && now - metadata.lastAccess > expireTime) {
        this.jsonCache.delete(key);
        this.cacheMetadata.delete(key);
      }
    }

    if (this.jsonCache.size > this.config.maxCacheSize) {
      const sortedCache = Array.from(this.cacheMetadata.entries()).sort(
        (a, b) => a[1].accessCount - b[1].accessCount
      );

      const toRemove = this.jsonCache.size - this.config.maxCacheSize;
      for (let i = 0; i < toRemove; i++) {
        const [key] = sortedCache[i];
        this.jsonCache.delete(key);
        this.cacheMetadata.delete(key);
      }
    }
  }

  emitDataChanged(reason, extra = {}) {
    if (this.eventBus) {
      this.eventBus.emit(EVENTS.DOMAIN.DATA_CHANGED, {
        reason,
        count: this.invoices.size,
        timestamp: new Date().toISOString(),
        ...extra
      });
    }
  }

  checkInvoiceLimit() {
    if (this.invoices.size > this.config.maxInvoices) {
      const excess = this.invoices.size - this.config.maxInvoices;

      const sortedEntries = Array.from(this.invoices.entries()).sort((a, b) => {
        const timeA = this.metadata.get(a[0])?.createdAt || 0;
        const timeB = this.metadata.get(b[0])?.createdAt || 0;
        return timeA - timeB;
      });

      for (let i = 0; i < excess; i++) {
        const [id] = sortedEntries[i];
        this.invoices.delete(id);
        this.metadata.delete(id);
        const index = this.invoiceOrder.indexOf(id);
        if (index !== -1) {
          this.invoiceOrder.splice(index, 1);
        }
      }
    }
  }

  startPeriodicCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      if (this.isDestroyed) {
        this.stopPeriodicCleanup();
        return;
      }

      this.cleanupExpiredCache();
      this.lastCleanup = Date.now();
    }, this.config.cleanupInterval);
  }

  stopPeriodicCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  getMemoryStats() {
    return {
      invoices: this.invoices.size,
      metadata: this.metadata.size,
      jsonCache: this.jsonCache.size,
      cacheMetadata: this.cacheMetadata.size,
      lastCleanup: this.lastCleanup,
      maxInvoices: this.config.maxInvoices,
      maxCacheSize: this.config.maxCacheSize
    };
  }

  insertIntoOrder(orderNo, options = {}) {
    if (options.position === 'top') {
      this.invoiceOrder.unshift(orderNo);
    } else if (options.afterId) {
      const index = this.invoiceOrder.indexOf(options.afterId);
      if (index !== -1) {
        this.invoiceOrder.splice(index + 1, 0, orderNo);
      } else {
        this.invoiceOrder.push(orderNo);
      }
    } else {
      this.invoiceOrder.push(orderNo);
    }
  }

  initializeOrder() {
    if (this.invoiceOrder.length === 0 && this.invoices.size > 0) {
      const entries = Array.from(this.invoices.entries()).sort(
        ([, a], [, b]) => {
          const aTime =
            a.created_at ||
            this.metadata.get(a.merchant_order_no)?.createdAt ||
            0;
          const bTime =
            b.created_at ||
            this.metadata.get(b.merchant_order_no)?.createdAt ||
            0;
          return new Date(aTime) - new Date(bTime);
        }
      );

      this.invoiceOrder = entries.map(([orderNo]) => orderNo);
    }
  }

  getInvoicesSnapshot() {
    return this.getAllInvoices();
  }

  destroy() {
    if (this.isDestroyed) return;

    this.isDestroyed = true;
    this.stopPeriodicCleanup();

    this.invoices.clear();
    this.metadata.clear();
    this.invoiceOrder = [];
    this.jsonCache.clear();
    this.cacheMetadata.clear();
  }

  registerCarrierProvider(platform, provider) {
    if (
      !provider ||
      typeof provider.getCarrierConfig !== 'function' ||
      typeof provider.describeCarrier !== 'function'
    ) {
      throw new Error(`Invalid carrier provider for ${platform}`);
    }

    if (typeof provider.getValidationRules !== 'function') {
      provider.getValidationRules = () => ({});
    }

    this.carrierProviders.set(platform, provider);
  }

  getCarrierProvider(platform) {
    return this.carrierProviders.get(platform) || null;
  }

  getCarrierDescription(platform, carrierCode) {
    const provider = this.getCarrierProvider(platform);
    if (provider && typeof provider.describeCarrier === 'function') {
      const description = provider.describeCarrier(carrierCode);
      if (description) {
        return description;
      }
    }
    return '';
  }

  resolveCarrierText(invoiceData = {}) {
    if (!invoiceData) {
      return '';
    }

    if (!invoiceData.carrier_type && !invoiceData.love_code) {
      return '列印發票';
    }

    if (invoiceData.love_code) {
      return '愛心碼捐贈';
    }

    if (!invoiceData.carrier_type) {
      return '';
    }

    const providerId =
      invoiceData.provider ||
      invoiceData.platform ||
      this.appState.currentPlatform ||
      null;

    if (providerId) {
      const provider = this.getCarrierProvider(providerId);
      if (provider && typeof provider.describeCarrier === 'function') {
        return provider.describeCarrier(invoiceData.carrier_type) || '';
      }
    }

    return '';
  }

  handleCredentialsLoaded({ provider, production, test, source }) {
    const config = {
      provider,
      production,
      test
    };
    this.storePlatformConfig(config);
  }
}
