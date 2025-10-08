/**
 * UIHandlers Module
 * User interface event handling and DOM interactions
 */
import { EVENTS } from '../core/events.js';

export class UIHandlers {
  constructor(eventBus, domElements = null, dataEngine = null, tableManager = null, statisticsManager = null, dialogManager = null) {
    this.eventBus = eventBus;
    this.dom = domElements || {};
    this.dataEngine = dataEngine;
    this.tableManager = tableManager;
    this.statisticsManager = statisticsManager;
    this.dialogManager = dialogManager;
    this.elementCache = new Map();
    this.eventsBound = false;
    this.eventUnsubscribers = [];
    this.domEventListeners = [];
    this.isDestroyed = false;
  }

  bindEvents() {
    if (this.eventsBound) return;
    this.eventsBound = true;

    this.setupDomainEvents();
    this.setupProcessEvents();
    this.setupUIEvents();
    this.setupAppEvents();
    this.setupDOMEvents();
    this.initScrollEffects();

  }

  setupDomainEvents() {
    this.eventBus.on(EVENTS.DOMAIN.INVOICE_ADDED, (data) =>
      this.handleInvoiceAdded(data));

    this.eventBus.on(EVENTS.DOMAIN.INVOICE_UPDATED, (data) =>
      this.handleInvoiceUpdated(data));

    this.eventBus.on(EVENTS.DOMAIN.INVOICE_DELETED, (data) =>
      this.handleInvoiceDeleted(data));

    this.eventBus.on(EVENTS.DOMAIN.DATA_IMPORTED, (data) =>
      this.handleDataImported(data));

    this.eventBus.on(EVENTS.DOMAIN.DATA_CHANGED, (data) => {
      this.handleDataChanged(data);
    });

    this.eventBus.on(EVENTS.DIALOG.CARRIER_CONFIG_SYNC, (data) =>
      this.handleCarrierConfigSync(data));

    this.eventBus.on(EVENTS.UI.CARRIER_DESCRIPTION_RESOLVED, (data) =>
      this.handleCarrierDescriptionResolved(data));

    this.eventBus.on(EVENTS.DOMAIN.DIALOG_SHOW_REQUESTED, (data) => {
      if (this.dialogManager) {
        this.dialogManager.show(data.type, data.data);
      }
    });


    this.eventBus.on(EVENTS.DOMAIN.ALERT_REQUESTED, (data) => {
      if (this.dialogManager) {
        this.dialogManager.handlePromptRequest(data);
      }
    });

    this.eventBus.on(EVENTS.COMMAND.CLEAR_DATA_FOR_PLATFORM_SWITCH, () => {
      this.clearDataSourceInput();
    });
  }

  setupProcessEvents() {
    this.eventBus.on(EVENTS.PROCESS.BATCH_STARTED, (data) =>
      this.handleBatchStarted(data));

    this.eventBus.on(EVENTS.PROCESS.ROW_PROCESSING, (data) =>
      this.handleRowProcessing(data));

    this.eventBus.on(EVENTS.PROCESS.ROW_SUCCESS, (data) =>
      this.handleRowSuccess(data));

    this.eventBus.on(EVENTS.PROCESS.ROW_FAILED, (data) =>
      this.handleRowFailed(data));

    this.eventBus.on(EVENTS.PROCESS.PROGRESS_UPDATE, (data) =>
      this.handleProgressUpdate(data));

    this.eventBus.on(EVENTS.PROCESS.FETCH_STARTED, (data) =>
      this.handleFetchStarted(data));

    this.eventBus.on(EVENTS.PROCESS.FETCH_COMPLETED, (data) =>
      this.handleFetchCompleted(data));

    this.eventBus.on(EVENTS.PROCESS.FETCH_ABORTED, (data) =>
      this.handleFetchAborted(data));

    this.eventBus.on(EVENTS.PROCESS.INVOICE_VOIDING, (data) =>
      this.handleInvoiceVoiding(data));

    this.eventBus.on(EVENTS.PROCESS.INVOICE_VOIDED, (data) =>
      this.handleInvoiceVoided(data));

    this.eventBus.on(EVENTS.PROCESS.BATCH_COMPLETED, (data) =>
      this.handleBatchCompleted(data));

    this.eventBus.on(EVENTS.PROCESS.BATCH_ABORTED, (data) =>
      this.handleBatchAborted(data));
  }

  setupUIEvents() {
    this.eventBus.on(EVENTS.UI.UPDATE_BUTTON, (data) => {
      if (data.action === 'filter_change') {
        this.handleFilterChange(data);
        return;
      }
      if (data.action === 'update_action_button') {
        this.updateActionButtonFromState(data);
      }
    });


  }


  setupAppEvents() {
    this.eventBus.on(EVENTS.APP_EVENTS.PLATFORM_CHANGED, (data) => {
      this.updateCurrentPlatform(data);
    });

    this.eventBus.on(EVENTS.APP_EVENTS.TEST_MODE_TOGGLED, (data) => {
      this.updateTestModeUI(data.isTestMode);
    });

    this.eventBus.on(EVENTS.APP_EVENTS.SCROLL_STATE_CHANGED, (data) => {
      this.handleScrollStateChange(data);
    });
  }

  handleInvoiceAdded({ id, data, source, originalOrderNo, position, afterId, summary }) {
    this.addInvoiceToView({ orderNo: id, data, source, originalOrderNo, position, afterId });

    if (this.statisticsManager) {
      const statistics = summary || this.dataEngine?.getStatistics();
      if (statistics) {
        this.statisticsManager.update(statistics);
      }
    }

    const hasData = this.dataEngine?.getInvoiceCount() > 0;
    this.updateTableVisibility(hasData);

    this.updateActionButton();
  }

  handleInvoiceUpdated({ id, data, summary }) {
    this.updateInvoiceInView({ orderNo: id, data: data });

    if (this.statisticsManager) {
      const statistics = summary || this.dataEngine?.getStatistics();
      if (statistics) {
        this.statisticsManager.update(statistics);
      }
    }

    this.updateActionButton();
  }

  handleInvoiceDeleted({ id, summary }) {
    if (this.tableManager) {
      this.tableManager.removeInvoiceFromTable({ orderNo: id });
    }

    if (this.statisticsManager) {
      const statistics = summary || this.dataEngine?.getStatistics();
      if (statistics) {
        this.statisticsManager.update(statistics);
      }
    }

    const hasData = this.dataEngine?.getInvoiceCount() > 0;
    this.updateTableVisibility(hasData);

    this.updateActionButton();
  }

  handleDataChanged({ reason, count, previousCount }) {
    this.updateTableVisibility(count > 0);
    this.updateActionButton();

    this.ensureBasicSectionsVisible();

    if (reason === 'clear' && previousCount > 0) {
      this.clearTableContent();
    }
  }

  handleDataImported({ results, source, provider, totalCount }) {
    const { successful, failed } = results;

    if (this.statisticsManager) {
      this.statisticsManager.update();
    }

    if (this.tableManager && results) {
      this.tableManager.refreshTable({ results, source });
    }

    const hasData = successful && successful.length > 0;
    this.updateTableVisibility(hasData);
    this.updateActionButton();

    const previewSection = this.getElement('previewSection');
    const statsSection = this.getElement('statsSection');

    if (previewSection) {
      this.showSection(previewSection);
    }
    if (statsSection) {
      this.showSection(statsSection);
    }
  }


  handleButtonStateUpdated(data) {
    if (data.buttonState) {
      this.updateActionButtonFromState(data.buttonState);
    }
  }


  handleRowProcessing({ orderNo, index }) {
    const invoiceData = this.dataEngine.getInvoice(orderNo);
    if (invoiceData) {
      invoiceData._status = 'processing';

      if (this.tableManager) {
        this.tableManager.updateRow(orderNo, { status: 'processing', error: null });
      }
      this.animateRowProcessing(orderNo);
    }
  }

  handleRowSuccess({ orderNo, invoiceNumber }) {
    const invoiceData = this.dataEngine.getInvoice(orderNo);
    if (invoiceData) {
      invoiceData._status = 'success';
      invoiceData.invoiceNumber = invoiceNumber;

      if (this.tableManager) {
        this.tableManager.updateRow(orderNo, {
          status: 'success',
          error: null,
          invoiceNumber
        });
      }
      this.updateRowCSSClass(orderNo, 'success');
    }
  }

  handleRowFailed({ orderNo, error }) {
    const invoiceData = this.dataEngine.getInvoice(orderNo);
    if (invoiceData) {
      invoiceData._status = 'failed';
      invoiceData._error = error;

      if (this.tableManager) {
        this.tableManager.updateRow(orderNo, { status: 'failed', error: error });
      }
      this.updateRowCSSClass(orderNo, 'failed');
    }
  }

  handleInvoiceVoiding({ orderNo }) {
    const invoiceData = this.dataEngine.getInvoice(orderNo);
    if (invoiceData) {
      invoiceData._status = 'processing';

      if (this.tableManager) {
        this.tableManager.updateRow(orderNo, { status: 'processing', error: null });
      }
    }
  }

  handleInvoiceVoided({ orderNo }) {
    const invoiceData = this.dataEngine.getInvoice(orderNo);
    if (invoiceData) {
      invoiceData._status = 'voided';

      if (this.tableManager) {
        this.tableManager.updateRow(orderNo, { status: 'voided', error: null });
      }
    }
  }

  handleFetchStarted(data) {
    const fetchProgress = document.getElementById('fetchProgress');
    if (fetchProgress) {
      fetchProgress.style.display = 'block';
    }
  }

  handleFetchCompleted(data) {
    const fetchProgress = document.getElementById('fetchProgress');
    if (fetchProgress) {
      fetchProgress.style.display = 'none';
    }
  }

  handleFetchAborted(data) {
    const fetchProgress = document.getElementById('fetchProgress');
    if (fetchProgress) {
      fetchProgress.style.display = 'none';
    }
  }

  handleProgressUpdate({ percentage, current, total, successful, failed }) {
    const progressText = `處理中: ${current}/${total}`;
    this.updateProgressDisplay(progressText);
  }

  updateProgressDisplay(text) {
    const progressEl = document.getElementById('progressDisplay');
    if (progressEl) {
      progressEl.textContent = text;
    }
  }


  handlePlatformChanged({ platform }) {
    this.updateCurrentPlatform(platform);
  }

  handleStateChange({ key, value, oldValue }) {
    switch (key) {
      case 'isProcessing':
        this.updateActionButton();
        break;
      case 'isTestMode':
        this.updateTestModeUI(value);
        break;
      case 'hasUploadedFile':
        this.updateActionButton();
        break;
      case 'uploadSession':
        this.updateSessionUI(value);
        break;
      case 'dataSourceValue':
        this.updateActionButton();
        break;
      case 'currentData':
        if (value && value.length > 0) {
              if (this.tableManager) {
            this.tableManager.refresh({ invoices: value });
          }
        }
        break;
    }
  }

  addInvoiceToView({ orderNo, data, source, originalOrderNo, position, afterId }) {
    const invoiceData = data || data.invoiceData;

    if (this.tableManager) {
      let tablePosition = 'bottom';
      let insertAfter = null;

      if (position === 'top') {
        tablePosition = 'top';
      } else if (afterId) {
        tablePosition = 'after';
        insertAfter = afterId;
      }

      this.tableManager.insertRows([{
        orderNo: orderNo || invoiceData.merchant_order_no,
        data: invoiceData,
        position: tablePosition,
        insertAfter: insertAfter,
        originalOrderNo: originalOrderNo
      }]);
    }
  }

  updateInvoiceInView({ orderNo, data: invoiceData, status, error }) {
    if (this.tableManager) {
      this.tableManager.updateRow(orderNo, { data: invoiceData, status, error });
    }
  }


  updateTableVisibility(hasData) {
    const emptyState = this.getElement('emptyState');
    const invoiceTable = this.getElement('invoiceTable');

    if (!emptyState || !invoiceTable) return;

    if (hasData) {
      emptyState.style.display = 'none';
      invoiceTable.style.display = 'block';
    } else {
      emptyState.style.display = 'block';
      invoiceTable.style.display = 'none';
    }
  }

  ensureBasicSectionsVisible() {
    const previewSection = this.getElement('previewSection');
    const statsSection = this.getElement('statsSection');

    if (previewSection) {
      this.showSection(previewSection);
    }
    if (statsSection) {
      this.showSection(statsSection);
    }
  }

  handleScrollStateChange(data) {
    const { isScrolled } = data;

    if (isScrolled) {
      document.body.classList.add('scrolled');
    } else {
      document.body.classList.remove('scrolled');
    }
  }

  handleUpdateButton(data) {
    if (data.action === 'filter_change') {
      this.handleFilterChange(data);
    } else if (data.action === 'add_item') {
    }
  }

  updateActionButtonFromState(buttonState) {
    const { isProcessing, showSend, showStart, showStop, canStart, canSend } =
      buttonState;

    this.dom.actionBtn.style.display = 'none';
    this.dom.actionBtnText.style.display = 'none';
    this.dom.actionBtnOutlined.style.display = 'none';

    if (isProcessing && showStop) {
      this.dom.actionBtnOutlined.style.display = 'inline-flex';
      this.dom.actionBtnOutlined.classList.remove('disabled');
    } else if (showStart) {
      this.dom.actionBtnText.style.display = 'inline-flex';
      this.dom.actionBtnText.disabled = !canStart;
    } else if (showSend) {
      this.dom.actionBtn.style.display = 'inline-flex';
      if (canSend) {
        this.dom.actionBtn.classList.remove('disabled');
      } else {
        this.dom.actionBtn.classList.add('disabled');
      }
    }
  }

  updateActionButton() {
    this.eventBus.emit(EVENTS.COMMAND.UPDATE_BUTTON_STATE);
  }

  showSend({ enabled }) {
    this.dom.actionBtn.style.display = 'inline-flex';
    this.dom.actionBtnText.style.display = 'none';
    this.dom.actionBtnOutlined.style.display = 'none';

    if (enabled) {
      this.dom.actionBtn.classList.remove('disabled');
    } else {
      this.dom.actionBtn.classList.add('disabled');
    }
  }

  showStart({ enabled }) {
    this.dom.actionBtnText.style.display = 'inline-flex';
    this.dom.actionBtn.style.display = 'none';
    this.dom.actionBtnOutlined.style.display = 'none';

    if (enabled) {
      this.dom.actionBtnText.disabled = false;
    } else {
      this.dom.actionBtnText.disabled = true;
    }
  }

  showStop() {
    this.dom.actionBtnOutlined.style.display = 'inline-flex';
    this.dom.actionBtn.style.display = 'none';
    this.dom.actionBtnText.style.display = 'none';
    this.dom.actionBtnOutlined.classList.remove('disabled');
  }

  clearTableContent() {
    const tableBody = document.getElementById('invoiceTableBody');
    if (tableBody) {
      tableBody.innerHTML = '';
    }
  }


  updateProgressBar(percentage) {
    const progressBar = this.getElement('progressBar');
    if (progressBar) {
      progressBar.style.width = `${percentage}%`;
    }
  }

  updateProgressText(text) {
    const progressText = this.getElement('progressText');
    if (progressText) {
      progressText.textContent = text;
    }
  }



  updateTestModeUI(isTestMode) {
    const testModeBtn = this.getElement('testModeBtn');
    if (testModeBtn) {
      testModeBtn.classList.toggle('selected', isTestMode);
    }
  }

  updateSessionUI(uploadSession) {
    if (!uploadSession) return;

    if (this.dom.dataSource) {
      if (uploadSession.source === 'local_file') {
        this.dom.dataSource.value = uploadSession.fileName || '';
      } else if (uploadSession.source === 'remote_url') {
        this.dom.dataSource.value = uploadSession.url || '';
      }
    }

    if (this.statisticsManager && (uploadSession.successCount || uploadSession.failedCount)) {
      this.statisticsManager.update({
        totalCount: (uploadSession.successCount || 0) + (uploadSession.failedCount || 0),
        successCount: uploadSession.successCount || 0,
        failedCount: uploadSession.failedCount || 0
      });
    }

    this.updateActionButton();
  }

  updateCurrentPlatform(data) {
    if (this.checkDestroyed()) return;

    const { platform, displayName } = typeof data === 'object'
      ? data
      : { platform: data };

    const platformElement = this.getElement('currentPlatform');
    if (platformElement && platform) {
      const name = displayName || platform;
      platformElement.textContent = name;
    }
  }

  clearDataSourceInput() {
    const element = this.dom.dataSource || document.getElementById('dataSource');
    if (element) {
      element.value = '';
    }
  }

  handleCarrierConfigSync({ platform, category, config, error }) {
    if (this.dialogManager) {
      this.dialogManager.applyCarrierConfig(config, platform, category);
    }
  }

  handleCarrierDescriptionResolved({ orderNo, description }) {
    if (this.tableManager) {
      this.tableManager.updateCarrierDescription(orderNo, description);
    }
  }

  requestCarrierConfig(platform, category) {
    this.eventBus.emit(EVENTS.DIALOG.CARRIER_CONFIG_REQUESTED, {
      platform,
      category
    });
  }

  toggleEmptyState(show) {
    const emptyState = document.getElementById('emptyState');
    const invoiceTable = document.getElementById('invoiceTable');

    if (emptyState && invoiceTable) {
      if (show) {
        emptyState.style.display = 'block';
        invoiceTable.style.display = 'none';
      } else {
        emptyState.style.display = 'none';
        invoiceTable.style.display = 'block';
      }
    }
  }

  showSection(section) {
    if (section) {
      section.style.display = 'block';
    }
  }

  getElement(id) {
    if (this.elementCache.has(id)) {
      return this.elementCache.get(id);
    }

    const element = this.dom[id] || document.getElementById(id);
    if (element) {
      this.elementCache.set(id, element);
    }

    return element;
  }

  destroy() {
    if (this.isDestroyed) return;

    this.isDestroyed = true;

    this.eventUnsubscribers.forEach((unsubscribe) => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    });
    this.eventUnsubscribers.length = 0;

    this.domEventListeners.forEach(({ element, event, handler, options }) => {
      element.removeEventListener(event, handler, options);
    });
    this.domEventListeners.length = 0;

    this.elementCache.clear();

    this.dom = null;
    this.eventBus = null;

  }

  checkDestroyed() {
    if (this.isDestroyed) {
      return true;
    }
    return false;
  }

  setupDOMEvents() {
    this.addDOMEventListener('addNewInvoiceBtn', 'click', () => {
      this.eventBus.emit(EVENTS.UI.ADD_INVOICE_CLICKED, {
        source: 'new_button',
        timestamp: Date.now()
      });
    });

    this.addDOMEventListener('mobileNewBtn', 'click', () => {
      this.eventBus.emit(EVENTS.UI.ADD_INVOICE_CLICKED, {
        source: 'mobile_invoice_header',
        timestamp: Date.now()
      });
    });

    this.addDOMEventListener('mobileMoreBtn', 'click', () => {
      const menu = document.getElementById('mobileMoreMenu');
      if (menu) {
        menu.open = !menu.open;
      }
    });

    this.addDOMEventListener('mobileDownloadMenuItem', 'click', () => {
      this.eventBus.emit(EVENTS.UI.DOWNLOAD_CLICKED, {
        source: 'mobile_app_bar',
        timestamp: Date.now()
      });
    });

    this.addDOMEventListener('mobileClearMenuItem', 'click', () => {
      this.eventBus.emit(EVENTS.UI.CLEAR_DATA_CLICKED, {
        source: 'mobile_app_bar',
        timestamp: Date.now()
      });
    });

    this.addDOMEventListener('uploadBtn', 'click', () => {
      this.openFilePicker();
    });

    this.addDOMEventListener('testModeBtn', 'click', () => {
      this.eventBus.emit(EVENTS.COMMAND.TOGGLE_TEST_MODE, {
        timestamp: new Date().toISOString()
      });
    });

    this.addDOMEventListener('actionBtn', 'click', () => {
      if (this.dom.actionBtn.disabled || this.dom.actionBtn.classList.contains('disabled')) {
        return;
      }

      const hasTableData = Boolean(this.dom.invoiceTableBody?.children.length);
      const element = this.dom.dataSource || document.getElementById('dataSource');
      const dataSourceValue = element?.value?.trim() || '';

      if (!hasTableData && dataSourceValue) {
        this.eventBus.emit(EVENTS.COMMAND.FETCH_DATA_SOURCE, { url: dataSourceValue });
      } else if (hasTableData) {
        this.eventBus.emit(EVENTS.UI.EXECUTE_CLICKED);
      }
    });

    this.addDOMEventListener('actionBtnText', 'click', () => {
      if (this.dom.actionBtnText.disabled || this.dom.actionBtnText.classList.contains('disabled')) {
        return;
      }

      this.eventBus.emit(EVENTS.UI.EXECUTE_CLICKED);
    });

    this.addDOMEventListener('actionBtnOutlined', 'click', () => {
      this.eventBus.emit(EVENTS.UI.STOP_CLICKED);
    });

    this.addDOMEventListener('moreActionsBtn', 'click', () => {
      this.eventBus.emit(EVENTS.UI.MORE_ACTIONS_CLICKED);
    });

    this.addDOMEventListener('downloadMenuItem', 'click', () => {
      this.eventBus.emit(EVENTS.UI.DOWNLOAD_CLICKED);
    });

    this.addDOMEventListener('clearDataMenuItem', 'click', () => {
      this.eventBus.emit(EVENTS.UI.CLEAR_DATA_CLICKED);
    });

    this.addDOMEventListener('dataSource', 'input', () => {
      const element = this.dom.dataSource || document.getElementById('dataSource');
      const inputValue = element?.value || '';

      this.eventBus.emit(EVENTS.UI.STATE_CHANGED, {
        key: 'dataSourceValue',
        value: inputValue
      });

      this.updateActionButton();
    });

    this.addDOMEventListener('addItemBtn', 'click', () => {
      this.eventBus.emit(EVENTS.UI.ADD_ITEM_CLICKED, { source: 'main_form' });
    });

    this.setupFilterTabEvents();

    this.addDOMEventListener('fileInput', 'change', (event) => {
      const file = event.target.files[0];
      if (file) {
        if (this.dom.dataSource) {
          this.dom.dataSource.value = file.name;
        }

        this.controller?.handleUIStateChange({
          key: 'dataSourceValue',
          value: file.name
        });

        this.eventBus.emit(EVENTS.UI.FILE_SELECTED, {
          file: file,
          name: file.name,
          size: file.size,
          type: file.type,
          source: this.filePickerSource || 'import'
        });

        this.updateActionButton();

        this.hideWelcomeScreen();
      }
    });

    this.addDOMEventListener('credentialCard', 'click', () => {
      this.openFilePicker({ source: 'credential' });
    });

    this.addDOMEventListener('importCard', 'click', () => {
      this.openFilePicker();
    });

    this.addDOMEventListener('demoCard', 'click', () => {
      this.hideWelcomeScreen();

      this.eventBus.emit(EVENTS.COMMAND.TOGGLE_TEST_MODE, {
        timestamp: new Date().toISOString()
      });

      fetch('./invoice-templates/ecpay.json')
        .then(response => response.json())
        .then(data => {
          this.eventBus.emit(EVENTS.COMMAND.UPLOAD_FILE, {
            file: {
              name: 'ecpay-demo.json',
              content: JSON.stringify(data),
              type: 'demo'
            },
            source: 'welcome_demo',
            timestamp: new Date().toISOString()
          });
        });
    });

    this.addDOMEventListener('skipWelcomeBtn', 'click', () => {
      this.hideWelcomeScreen();
    });

    this.addDOMEventListener('infoButton', 'click', (e) => {
      e.stopPropagation();
      const infoTooltip = document.getElementById('infoTooltip');
      if (infoTooltip) {
        infoTooltip.classList.remove('hidden');
      }
    });

    this.addDOMEventListener('closeTooltip', 'click', () => {
      const infoTooltip = document.getElementById('infoTooltip');
      if (infoTooltip) {
        infoTooltip.classList.add('hidden');
      }
    });

    document.addEventListener('click', (e) => {
      const infoTooltip = document.getElementById('infoTooltip');
      const infoButton = document.getElementById('infoButton');
      if (infoTooltip && infoButton) {
        if (!infoTooltip.contains(e.target) && !infoButton.contains(e.target)) {
          infoTooltip.classList.add('hidden');
        }
      }
    });

  }

  setupFilterTabEvents() {
    const filterTabs = document.querySelectorAll('.filter-tab');
    filterTabs.forEach((tab) => {
      const handler = () => {
        filterTabs.forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');

        const status = tab.getAttribute('data-status');
        this.eventBus.emit(EVENTS.UI.FILTER_CHANGED, { status });
      };

      tab.addEventListener('click', handler);
      this.domEventListeners.push({ element: tab, event: 'click', handler });
    });

  }

  addDOMEventListener(elementId, event, handler) {
    const element = document.getElementById(elementId);
    if (element) {
      element.addEventListener(event, handler);
      this.domEventListeners.push({ element, event, handler });
    }
  }

  initScrollEffects() {
    const handleScroll = () => {
      const scrollTop =
        window.scrollY || document.documentElement.scrollTop;
      const isScrolled = scrollTop > 10;

      this.eventBus.emit(EVENTS.APP_EVENTS.SCROLL_STATE_CHANGED, {
        isScrolled,
        scrollTop,
        container: 'window',
        timestamp: new Date().toISOString()
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    this.scrollEffectsHandler = handleScroll;
    this.scrollContainer = window;
  }

  destroy() {
    if (this.scrollEffectsHandler && this.scrollContainer) {
      if (this.scrollContainer === window) {
        window.removeEventListener('scroll', this.scrollEffectsHandler);
      } else {
        this.scrollContainer.removeEventListener(
          'scroll',
          this.scrollEffectsHandler
        );
      }
    }

    if (this.observer) {
      this.observer.disconnect();
    }

    this.eventUnsubscribers.forEach((unsubscribe) => unsubscribe());
    this.eventUnsubscribers = [];

    this.domEventListeners.forEach(({ element, event, handler }) => {
      if (element) {
        element.removeEventListener(event, handler);
      }
    });
    this.domEventListeners = [];

  }

  handleRequestFileDialog(data) {
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
      fileInput.click();
    }
  }

  handleToggleMoreActions(data) {
    const moreActionsMenu = document.getElementById('moreActionsMenu');
    if (moreActionsMenu) {
      moreActionsMenu.open = !moreActionsMenu.open;
    }
  }

  handleSyncStatistics(data) {
    if (this.statisticsManager) {
      this.statisticsManager.update();
    }
  }

  handleSyncEmptyState(data) {
    const { hasData } = data;
    this.updateTableVisibility(hasData);
  }



  toggleSecondaryActions() {
    const moreActionsMenu = document.getElementById('moreActionsMenu');
    if (moreActionsMenu) {
      moreActionsMenu.open = !moreActionsMenu.open;
    }
  }

  hideWelcomeScreen() {
    const welcomeScreen = document.getElementById('welcomeScreen');
    const mainContent = document.querySelector('main');
    const fixedBottom = document.querySelector('.fixed.bottom-0');

    if (welcomeScreen && mainContent) {
      document.body.classList.remove('welcome-active');
      welcomeScreen.classList.add('fade-out');

      setTimeout(() => {
        welcomeScreen.style.display = 'none';
        requestAnimationFrame(() => {
          mainContent.classList.add('show');
          if (fixedBottom) {
            fixedBottom.classList.add('show');
          }
        });
      }, 600);
    }
  }

  openFilePicker(options = {}) {
    this.filePickerSource = options.source || 'import';
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
      if (options.accept) {
        fileInput.setAttribute('accept', options.accept);
      }
      if (options.multiple) {
        fileInput.setAttribute('multiple', '');
      } else {
        fileInput.removeAttribute('multiple');
      }

      fileInput.click();
    }
  }




  handleFilterChange({ status }) {
    if (!this.tableManager) return;
    this.tableManager.applyTableFilter(status || 'all');
    this.updateActionButton();
  }

  animateRowProcessing(orderNo) {
    const row = document.querySelector(`tr[data-order-no="${orderNo}"]`);
    if (row) {
      row.classList.add('processing-animation');
    }
  }

  updateRowCSSClass(orderNo, status) {
    const row = document.querySelector(`tr[data-order-no="${orderNo}"]`);
    if (row) {
      row.classList.remove('processing-animation', 'row-success', 'row-failed');
      if (status === 'success') {
        row.classList.add('row-success');
      } else if (status === 'failed') {
        row.classList.add('row-failed');
      }
    }
  }

}
