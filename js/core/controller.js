/**
 * Controller Module
 * Business logic coordination and platform management
 */

import { EVENTS } from './events.js';
import { detectPlatformFromFilename } from '../utils/platform-utils.js';

export class Controller {
  constructor(
    eventBus,
    dataEngine,
    platforms,
    tableManager,
    statisticsManager,
    dialogManager,
    formHandler,
    uiHandlers,
    app,
    exportManager
  ) {
    this.eventBus = eventBus;
    this.dataEngine = dataEngine;
    this.platforms = platforms;
    this.tableManager = tableManager;
    this.statisticsManager = statisticsManager;
    this.dialogManager = dialogManager;
    this.formHandler = formHandler;
    this.uiHandlers = uiHandlers;
    this.app = app;
    this.exportManager = exportManager;
    this.state = {
      isProcessing: false,
      hasUploadedFile: false,
      isTestMode: false,
      currentPlatform: app?.state?.currentPlatform || null,
      hasProcessingInvoice: false,
      dataSourceValue: ''
    };

    this.fetchAbortController = null;

    this.setupEventListeners();

    setTimeout(() => {
      this.updateButtonState();
    }, 100);
  }

  calculateButtonState() {
    const {
      isProcessing,
      hasUploadedFile,
      hasProcessingInvoice,
      dataSourceValue
    } = this.state;

    const invoiceCount = this.dataEngine.getInvoiceCount();
    const hasTableData = invoiceCount > 0;
    const hasDataSourceInput = Boolean(dataSourceValue?.trim());

    const showSend = !hasTableData && !isProcessing;
    const showStart = hasTableData && !isProcessing;
    const canSend = showSend && hasDataSourceInput;
    const canStart = showStart && !hasProcessingInvoice;


    return {
      isProcessing,
      hasUploadedFile,
      hasDataSourceInput,
      hasTableData,
      hasProcessingInvoice,
      canStart,
      canSend,
      canStop: isProcessing,
      showSend,
      showStart,
      showStop: isProcessing
    };
  }

  hasInvoiceData() {
    return this.dataEngine.getInvoiceCount() > 0;
  }

  updateButtonState() {
    const buttonState = this.calculateButtonState();
    this.eventBus.emit(EVENTS.UI.UPDATE_BUTTON, {
      action: 'update_action_button',
      ...buttonState
    });
  }

  handleScrollChange(data) {
    this.setState('isScrolled', data.isScrolled);
    this.eventBus.emit(EVENTS.APP_EVENTS.SCROLL_STATE_CHANGED, data);
  }

  setupEventListeners() {
    this.eventBus.on(EVENTS.UI.ADD_INVOICE_CLICKED, () =>
      this.handleAddInvoice()
    );

    this.eventBus.on(EVENTS.COMMAND.TOGGLE_TEST_MODE, () =>
      this.handleTestMode()
    );
    this.eventBus.on(EVENTS.UI.EXECUTE_CLICKED, () => this.handleExecute());
    this.eventBus.on(EVENTS.UI.STOP_CLICKED, () => this.handleStop());
    this.eventBus.on(EVENTS.UI.DOWNLOAD_CLICKED, () => this.handleDownload());
    this.eventBus.on(EVENTS.UI.CLEAR_DATA_CLICKED, () =>
      this.handleClearData()
    );

    this.eventBus.on(EVENTS.COMMAND.CREATE_INVOICE, (data) =>
      this.handleCreateInvoice(data)
    );
    this.eventBus.on(EVENTS.COMMAND.UPDATE_INVOICE, (data) =>
      this.handleUpdateInvoice(data)
    );
    this.eventBus.on(EVENTS.COMMAND.SAVE_INVOICE, (payload) =>
      this.handleSaveInvoice(payload)
    );
    this.eventBus.on(EVENTS.COMMAND.DELETE_INVOICE, (data) =>
      this.handleDeleteInvoice(data)
    );
    this.eventBus.on(EVENTS.COMMAND.VOID_INVOICE, (data) =>
      this.handleVoidInvoice(data)
    );

    this.eventBus.on(EVENTS.PLATFORM.CREDENTIALS_RESPONSE, (data) =>
      this.handleCredentialsResponse(data)
    );
    this.eventBus.on(EVENTS.UI.FILTER_CHANGED, (data) =>
      this.handleFilterChange(data)
    );
    this.eventBus.on(EVENTS.UI.FILE_SELECTED, (data) =>
      this.handleFileSelected(data)
    );
    this.eventBus.on(EVENTS.COMMAND.UPLOAD_FILE, (data) =>
      this.handleUploadFile(data)
    );

    this.eventBus.on(EVENTS.COMMAND.CLEAR_DATA_FOR_PLATFORM_SWITCH, (data) =>
      this.handleClearDataForPlatformSwitch(data)
    );

    this.eventBus.on(EVENTS.COMMAND.FETCH_DATA_SOURCE, (data) =>
      this.handleDataSourceFetch(data)
    );

    this.eventBus.on(EVENTS.COMMAND.FETCH_CARRIER_CONFIG, (data) =>
      this.handleFetchCarrierConfig(data)
    );

    this.eventBus.on(EVENTS.APP_EVENTS.PLATFORM_CHANGED, (data) =>
      this.handlePlatformChanged(data)
    );

    this.eventBus.on(EVENTS.FORM.CATEGORY_CHANGED, (data) =>
      this.handleCategoryChanged(data)
    );

    this.eventBus.on(EVENTS.DIALOG.CARRIER_CONFIG_REQUESTED, (data) =>
      this.handleCarrierConfigRequested(data)
    );

    this.eventBus.on(EVENTS.UI.CARRIER_DESCRIPTION_REQUESTED, (data) =>
      this.handleCarrierDescriptionRequested(data)
    );

    this.eventBus.on(EVENTS.PROCESS.BATCH_STARTED, () => {
      this.setState('isProcessing', true);
      this.setState('hasProcessingInvoice', false);
      this.updateButtonState();
    });
    this.eventBus.on(EVENTS.PROCESS.BATCH_COMPLETED, () => {
      this.setState('isProcessing', false);
      this.setState('hasProcessingInvoice', false);
      this.updateButtonState();
    });
    this.eventBus.on(EVENTS.PROCESS.BATCH_ABORTED, () => {
      this.setState('isProcessing', false);
      this.setState('hasProcessingInvoice', false);
      this.updateButtonState();
    });
    this.eventBus.on(EVENTS.PROCESS.BATCH_PAUSED, () => {
      this.setState('isProcessing', false);
      this.setState('hasProcessingInvoice', true);
      this.updateButtonState();
    });

    this.eventBus.on(EVENTS.PROCESS.ROW_SUCCESS, (data) => {
      if (data.orderNo && this.dataEngine) {
        this.dataEngine.updateInvoiceStatus(data.orderNo, 'success');
        if (data.invoiceDate) {
          this.dataEngine.updateInvoice(data.orderNo, {
            invoiceDate: data.invoiceDate
          });
        }
      }
    });

    this.eventBus.on(EVENTS.PROCESS.ROW_FAILED, (data) => {
      if (data.orderNo && this.dataEngine) {
        this.dataEngine.updateInvoiceStatus(data.orderNo, 'failed');
      }
    });

    this.eventBus.on(EVENTS.COMMAND.UPDATE_BUTTON_STATE, () => {
      this.updateButtonState();
    });

    this.eventBus.on(EVENTS.DOMAIN.DATA_CHANGED, () => {
      this.updateButtonState();
    });

    this.eventBus.on(EVENTS.UI.TABLE_ACTION_CLICKED, (data) => {
      this.handleTableAction(data);
    });

    this.eventBus.on(EVENTS.UI.MORE_ACTIONS_CLICKED, () =>
      this.handleMoreActions()
    );

    this.eventBus.on(EVENTS.UI.ADD_ITEM_CLICKED, () => this.handleAddItem());

    this.eventBus.on(EVENTS.UI.STATE_CHANGED, (data) => {
      this.handleUIStateChange(data);
    });
  }


  handleAddInvoice() {
    const dialogData = {
      mode: 'create',
      data: {
        category: 'B2B',
        items: [
          {
            name: '',
            quantity: 1,
            unitPrice: 0,
            amount: 0
          }
        ]
      },
      timestamp: new Date().toISOString()
    };

    this.eventBus.emit(EVENTS.DOMAIN.DIALOG_SHOW_REQUESTED, {
      type: 'invoice:create',
      data: dialogData
    });
  }

  handleTestMode() {
    this.setState('isTestMode', !this.state.isTestMode);
    this.eventBus.emit(EVENTS.APP_EVENTS.TEST_MODE_TOGGLED, {
      isTestMode: this.state.isTestMode
    });
  }

  async handleExecute() {
    const platform = this.state.currentPlatform;
    if (!platform) {
      return;
    }

    const mode = this.state.isTestMode ? 'test' : 'production';
    const config = await this.dataEngine.getPlatformConfig(platform);

    if (!config) {
      this.eventBus.emit(EVENTS.DOMAIN.ALERT_REQUESTED, {
        type: 'credentials_missing'
      });
      return;
    }

    const targetCredentials = config[mode];
    if (!targetCredentials) {
      this.eventBus.emit(EVENTS.DOMAIN.ALERT_REQUESTED, {
        type: 'credentials_mode_missing',
        data: {
          mode: mode,
          env: mode
        }
      });
      return;
    }

    if (this.state.isTestMode && config.production && !config.test) {
      this.eventBus.emit(EVENTS.DOMAIN.ALERT_REQUESTED, {
        type: 'credentials_mode_missing',
        data: {
          mode: 'test',
          env: 'test'
        }
      });
      return;
    }

    if (!this.state.isTestMode && config.test && !config.production) {
      this.eventBus.emit(EVENTS.DOMAIN.ALERT_REQUESTED, {
        type: 'credentials_mode_missing',
        data: {
          mode: 'production',
          env: 'production'
        }
      });
      return;
    }

    this.eventBus.emit(EVENTS.COMMAND.START_BATCH, {
      platform,
      testMode: this.state.isTestMode
    });
  }

  handleStop() {
    this.setState('hasProcessingInvoice', false);
    this.setState('isProcessing', false);
    this.updateButtonState();

    if (this.fetchAbortController) {
      this.fetchAbortController.abort();
      this.fetchAbortController = null;
    }

    this.eventBus.emit(EVENTS.COMMAND.STOP_BATCH, {
      timestamp: new Date().toISOString()
    });
  }

  handleDownload() {
    if (this.exportManager) {
      this.exportManager.handleExport({
        format: 'json',
        timestamp: new Date().toISOString()
      });
    }
  }

  async handleClearData() {
    const invoiceCount = this.dataEngine.getInvoiceCount();
    if (invoiceCount === 0) {
      return;
    }

    this.eventBus.emit(EVENTS.DOMAIN.CONFIRMATION_REQUESTED, {
      type: 'clear_data',
      data: {
        count: invoiceCount
      },
      onConfirm: () => {
        const result = this.dataEngine.clearAllInvoices();
        this.setState('hasUploadedFile', false);
        this.updateButtonState();

        this.eventBus.emit(EVENTS.DOMAIN.DATA_CHANGED, {
          type: 'clear',
          reason: 'user_clear_all',
          count: 0,
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  handleFilterChange(data) {
    if (this.tableManager) {
      this.tableManager.applyTableFilter(data.status || 'all');
    }
    this.updateButtonState();
  }

  async handleUploadFile(data) {
    try {
      let fileContent;

      if (data.file.type === 'demo' && data.file.content) {
        fileContent = data.file.content;
      } else if (data.file instanceof File) {
        fileContent = await this.readFileContent(data.file);
      } else {
        return;
      }

      const result = await this.processFileData(fileContent, data.file.name);
      this.setState('hasUploadedFile', result?.successCount > 0);
    } catch (error) {
      throw error;
    }
  }

  async handleFileSelected(data) {
    const fileContent = await this.readFileContent(data.file);
    const skipInvoices = data.source === 'credential';
    const result = await this.processFileData(fileContent, data.name, skipInvoices);
    this.setState('hasUploadedFile', result?.successCount > 0);

    if (result) {
      this.dataEngine.setUploadSession({
        source: 'local_file',
        fileName: data.name,
        successCount: result.successCount,
        failedCount: result.failedCount,
        provider: this.state.currentPlatform,
        importedAt: new Date().toISOString()
      });
    }

    this.setState('dataSourceValue', '');
    this.updateButtonState();
  }

  readFileContent(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsText(file);
    });
  }

  async processFileData(content, fileName, skipInvoices = false) {
    try {
      const jsonData = JSON.parse(content);

      let invoicesArray = [];

      if (skipInvoices) {
        invoicesArray = [];
      } else if (Array.isArray(jsonData)) {
        invoicesArray = jsonData;
      } else if (jsonData && typeof jsonData === 'object') {
        if (jsonData.invoices !== undefined) {
          invoicesArray = Array.isArray(jsonData.invoices)
            ? jsonData.invoices
            : [];
        } else if (jsonData.data && Array.isArray(jsonData.data)) {
          invoicesArray = jsonData.data;
        } else if (jsonData.items && Array.isArray(jsonData.items)) {
          invoicesArray = jsonData.items;
        } else if (
          jsonData.provider &&
          (jsonData.test || jsonData.production)
        ) {
          invoicesArray = [];
        } else {
          invoicesArray = [jsonData];
        }
      } else {
        return;
      }

      const successful = [];
      const failed = [];

      for (let i = 0; i < invoicesArray.length; i++) {
        const invoice = invoicesArray[i];
        try {
          if (!invoice || typeof invoice !== 'object') {
            continue;
          }

          const hasInvoiceProps =
            invoice.buyer_name ||
            invoice.customer_name ||
            invoice.items ||
            invoice.total_amt ||
            invoice.amount;

          if (!hasInvoiceProps) {
            continue;
          }

          successful.push({
            ...invoice,
            index: i,
            status: 'imported',
            buyer_name:
              invoice.buyer_name || invoice.customer_name || '',
            items: invoice.items || []
          });
        } catch (validationError) {
          failed.push({
            index: i,
            data: invoice,
            error: validationError.message
          });
        }
      }

      let detectedProvider = null;
      if (jsonData.platform_config && jsonData.platform_config.provider) {
        detectedProvider = jsonData.platform_config.provider;
      } else if (jsonData.provider) {
        detectedProvider = jsonData.provider;
      }

      if (detectedProvider) {
        let credentialSource;
        if (jsonData.platform_config && jsonData.platform_config.provider) {
          credentialSource = jsonData.platform_config;
        } else {
          credentialSource = jsonData;
        }

        if (credentialSource.test || credentialSource.production) {
          const normalizedConfig = {
            provider: detectedProvider,
            production: normalizeCredentials(credentialSource.production),
            test: normalizeCredentials(credentialSource.test)
          };

          if (normalizedConfig.test || normalizedConfig.production) {
            if (!this.state.currentPlatform) {
              this.setState('currentPlatform', detectedProvider);
            }

            this.eventBus.emit(EVENTS.PLATFORM.CREDENTIALS_LOADED, {
              provider: detectedProvider,
              production: normalizedConfig.production,
              test: normalizedConfig.test,
              source: jsonData.platform_config ? 'platform_config' : 'root',
              timestamp: new Date().toISOString()
            });
          } else {
            this.eventBus.emit(EVENTS.DOMAIN.ALERT_REQUESTED, {
              type: 'invalid_credentials',
              data: {
                provider: detectedProvider
              }
            });
          }
        }
      }

      if (detectedProvider && detectedProvider !== this.state.currentPlatform) {
        const platformInstance = this.platforms[detectedProvider];
        const displayName = platformInstance?.displayName || detectedProvider;

        this.setState('currentPlatform', detectedProvider);
        localStorage.setItem('selectedPlatform', detectedProvider);

        this.eventBus.emit(EVENTS.APP_EVENTS.PLATFORM_CHANGED, {
          platform: detectedProvider,
          displayName,
          source: 'json_upload',
          timestamp: new Date().toISOString()
        });
      }

      if (this.dataEngine && this.dataEngine.setInvoices) {
        const result = this.dataEngine.setInvoices(successful);
      }

      let provider = detectedProvider || detectPlatformFromFilename(fileName);

      return {
        results: { successful, failed },
        provider,
        totalCount: invoicesArray.length,
        successCount: successful.length,
        failedCount: failed.length
      };
    } catch (parseError) {
      return null;
    }
  }

  setState(key, value) {
    const oldValue = this.state[key];
    this.state[key] = value;

    if (key === 'dataSourceValue' || key === 'uploadSession') {
      this.uiHandlers?.handleStateChange({ key, value, oldValue });
    }
  }

  handleUIStateChange({ key, value }) {
    this.setState(key, value);

    if (key === 'dataSourceValue') {
      this.updateButtonState();
    }
  }

  async handleDataSourceFetch({ url }) {
    try {
      if (!url) {
        throw new Error();
      }

      if (!url.toLowerCase().endsWith('.json')) {
        throw new Error();
      }

      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }

      this.setState('isProcessing', true);
      this.updateButtonState();
      this.eventBus.emit(EVENTS.PROCESS.FETCH_STARTED, {
        url,
        timestamp: new Date().toISOString()
      });

      const response = await this.fetchWithTimeout(url, 10000);
      const jsonText = await response.text();

      let fileName;
      try {
        const urlPath = new URL(url).pathname;
        fileName = urlPath.split('/').pop();
        if (!fileName) {
          throw new Error();
        }
      } catch {
        throw new Error();
      }

      const result = await this.processFileData(jsonText, fileName);

      if (result && result.successCount > 0) {
        this.setState('hasUploadedFile', true);

        this.dataEngine.setUploadSession({
          source: 'remote_url',
          url: url,
          fileName: fileName,
          successCount: result.successCount,
          failedCount: result.failedCount,
          provider: this.state.currentPlatform,
          importedAt: new Date().toISOString()
        });

        this.eventBus.emit(EVENTS.PROCESS.FETCH_COMPLETED, {
          url,
          success: true,
          successCount: result.successCount,
          timestamp: new Date().toISOString()
        });
      } else {
        this.setState('hasUploadedFile', false);
        this.eventBus.emit(EVENTS.PROCESS.FETCH_COMPLETED, {
          url,
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      this.setState('isProcessing', false);
      this.fetchAbortController = null;
      this.updateButtonState();
    } catch (error) {
      this.setState('isProcessing', false);
      this.fetchAbortController = null;
      this.updateButtonState();

      if (error.name === 'AbortError') {
        this.eventBus.emit(EVENTS.PROCESS.FETCH_ABORTED, {
          url,
          timestamp: new Date().toISOString()
        });
      } else {
        this.eventBus.emit(EVENTS.DOMAIN.ALERT_REQUESTED, {
          type: 'fetch_error'
        });
        this.eventBus.emit(EVENTS.PROCESS.FETCH_COMPLETED, {
          url,
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  fetchWithTimeout(url, timeout = 10000) {
    this.fetchAbortController = new AbortController();
    let timeoutId;

    const fetchPromise = fetch(url, {
      signal: this.fetchAbortController.signal
    });

    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Request timeout')), timeout);
    });

    return Promise.race([fetchPromise, timeoutPromise])
      .then(response => {
        clearTimeout(timeoutId);
        return response;
      })
      .catch(error => {
        clearTimeout(timeoutId);
        throw error;
      });
  }

  getState(key) {
    return key ? this.state[key] : { ...this.state };
  }

  handleAddItem() {
    this.eventBus.emit(EVENTS.UI.UPDATE_BUTTON, {
      action: 'add_item'
    });
  }

  handleMoreActions() {
    const moreActionsMenu = document.getElementById('moreActionsMenu');
    if (moreActionsMenu) {
      moreActionsMenu.open = !moreActionsMenu.open;
    }
  }

  async handleCreateInvoice(data) {
    const { formData } = data;
    const newOrderNo = this.dataEngine.generateOrderNo();
    const result = this.dataEngine.addInvoice(newOrderNo, {
      ...formData,
      merchant_order_no: newOrderNo,
      created_at: new Date().toISOString()
    }, 'created', null, {
      position: 'top'
    });
  }

  async handleUpdateInvoice(data) {
    const { orderNo, formData } = data;
    const result = this.dataEngine.updateInvoice(orderNo, formData);
  }

  async handleSaveInvoice({ mode, orderNo, formData }) {
    const enrichedFormData = {
      ...formData,
      provider: formData.provider || this.getActivePlatformId()
    };

    if (mode === 'create') {
      const newOrderNo = this.dataEngine.generateOrderNo();
      this.dataEngine.addInvoice(newOrderNo, {
        ...enrichedFormData,
        merchant_order_no: newOrderNo,
        _status: 'pending',
        created_at: new Date().toISOString()
      }, 'created', null, {
        position: 'top'
      });
    } else if (mode === 'edit') {
      this.dataEngine.updateInvoice(orderNo, enrichedFormData);
    }
  }

  async handleVoidInvoice(data) {
    const { orderNo } = data;
    this.handleVoidRequest(orderNo);
  }

  async handleDeleteInvoice(data) {
    const { orderNo, confirmRequired = true } = data;

    const result = this.dataEngine.deleteInvoice(orderNo);

    if (!result.success) {
      this.eventBus.emit(EVENTS.ERROR.PROCESSING_FAILED, {
        action: 'delete_invoice',
        orderNo,
        error: result.error || 'delete_failed'
      });
    }
  }

  async handleInvoiceDelete(event) {
    const { orderNo } = event.detail;

    await this.handleDeleteInvoice({
      orderNo,
      confirmRequired: true,
      timestamp: new Date().toISOString()
    });
  }


  async handleClearDataForPlatformSwitch(data) {
    const currentCount = this.dataEngine.getInvoiceCount();

    if (currentCount > 0) {
      const result = this.dataEngine.clearAllInvoices();

      if (result?.success !== false) {
        this.updateUIAfterDataChange({
          type: 'clear',
          reason: data.reason || 'platform_switch',
          newPlatform: data.newPlatform,
          count: 0,
          previousCount: currentCount,
          filterState: null
        });
      } else {
        return;
      }
    }
  }

  handlePlatformChanged(data) {
    this.setState('currentPlatform', data.platform);
  }

  async handleCategoryChanged(data) {
    const { category } = data;

    await this.syncCarrierConfig(category);
  }

  async syncCarrierConfig(category) {
    const platformId = this.state.currentPlatform;

    if (!platformId) return;

    try {
      const platformInstance = this.platforms[platformId];
      if (!platformInstance || !platformInstance.getCarrierConfig) {
        return;
      }

      const carrierConfig = platformInstance.getCarrierConfig(category);
      this.eventBus.emit(EVENTS.DIALOG.CARRIER_CONFIG_SYNC, {
        platform: platformId,
        category,
        config: carrierConfig
      });
    } catch (error) {
      this.eventBus.emit(EVENTS.DIALOG.CARRIER_CONFIG_SYNC, {
        platform: platformId,
        category,
        config: null,
        error: error.message
      });
    }
  }

  async handleCarrierConfigRequested(data) {
    const { platform, category } = data;
    const platformId = platform || this.state.currentPlatform;

    if (!platformId) return;

    try {
      const provider = this.dataEngine.getCarrierProvider(platformId);
      if (!provider) {
        this.eventBus.emit(EVENTS.DIALOG.CARRIER_CONFIG_SYNC, {
          platform: platformId,
          category,
          config: [],
          error: 'carrier_provider_missing'
        });
        return;
      }

      const config = provider.getCarrierConfig(category || 'B2C');
      this.eventBus.emit(EVENTS.DIALOG.CARRIER_CONFIG_SYNC, {
        platform: platformId,
        category,
        config
      });
    } catch (error) {
      this.eventBus.emit(EVENTS.DIALOG.CARRIER_CONFIG_SYNC, {
        platform: platformId,
        category,
        config: [],
        error: error.message
      });
    }
  }

  handleFetchCarrierConfig(data) {
    return this.handleCarrierConfigRequested(data);
  }

  handleCarrierDescriptionRequested({ platform, carrierCode, orderNo }) {
    const description = this.dataEngine.getCarrierDescription(platform, carrierCode);
    this.eventBus.emit(EVENTS.UI.CARRIER_DESCRIPTION_RESOLVED, {
      orderNo,
      description
    });
  }

  getCurrentPlatform() {
    return this.state.currentPlatform;
  }

  getPlatformInstance() {
    return this.platforms[this.getCurrentPlatform()] || null;
  }

  getActivePlatformId() {
    return this.state.currentPlatform;
  }

  getCarrierProvider() {
    const platformId = this.getActivePlatformId();
    if (!platformId) {
      return null;
    }
    return this.dataEngine.getCarrierProvider(platformId);
  }

  handleCredentialsResponse({
    provider,
    mode,
    valid,
    missingFields,
    isValid,
    error
  }) {
    const credentialsValid = valid || isValid;

    if (credentialsValid) {
      this.eventBus.emit(EVENTS.COMMAND.START_BATCH, {
        platform: provider,
        testMode: this.state.isTestMode,
        timestamp: new Date().toISOString()
      });
    } else {
      const modeDisplay = mode === 'test' ? 'test' : 'production';
      this.eventBus.emit(EVENTS.DOMAIN.ALERT_REQUESTED, {
        type: 'credentials_validation_failed',
        data: {
          mode: modeDisplay
        }
      });
    }
  }

  handleTableAction(data) {
    const { action, orderNo } = data;

    if (!orderNo) {
      return;
    }

    switch (action) {
      case 'detail':
      case 'edit':
        this.handleEditRequest(orderNo);
        break;
      case 'duplicate':
        this.handleDuplicateRequest(orderNo);
        break;
      case 'delete':
        this.handleDeleteRequest(orderNo);
        break;
      case 'void':
        this.handleVoidRequest(orderNo);
        break;
      default:
    }
  }

  async handleEditRequest(orderNo) {
    const invoiceData = this.dataEngine.getInvoice(orderNo);

    this.eventBus.emit(EVENTS.DOMAIN.DIALOG_SHOW_REQUESTED, {
      type: 'invoice:edit',
      data: {
        mode: 'edit',
        orderNo: orderNo,
        data: invoiceData
      }
    });
  }

  handleDuplicateRequest(orderNo) {
    const originalInvoice = this.dataEngine.getInvoice(orderNo);

    if (!originalInvoice) {
      this.eventBus.emit(EVENTS.DOMAIN.ALERT_REQUESTED, {
        type: 'fetch_error'
      });
      return;
    }

    const duplicatedInvoice = JSON.parse(JSON.stringify(originalInvoice));

    duplicatedInvoice.merchant_order_no = this.dataEngine.generateOrderNo();
    duplicatedInvoice._status = 'pending';
    duplicatedInvoice.created_at = new Date().toISOString();
    duplicatedInvoice.provider = duplicatedInvoice.provider || this.getActivePlatformId();

    if (duplicatedInvoice.items && Array.isArray(duplicatedInvoice.items)) {
      duplicatedInvoice.items = [...duplicatedInvoice.items];
    }

    const result = this.dataEngine.addInvoice(
      duplicatedInvoice.merchant_order_no,
      duplicatedInvoice,
      'duplicated',
      orderNo,
      {
        afterId: orderNo
      }
    );
  }

  handleDeleteRequest(orderNo) {
    this.handleDeleteInvoice({
      orderNo,
      confirmRequired: false,
      timestamp: new Date().toISOString()
    });
  }

  handleVoidRequest(orderNo) {
    const invoice = this.dataEngine.getInvoice(orderNo);
    const invoiceNumber =
      invoice.invoice_number ||
      invoice.invoiceNumber ||
      invoice.merchant_order_no;

    this.eventBus.emit(EVENTS.DOMAIN.CONFIRMATION_REQUESTED, {
      type: 'void_invoice',
      message: `確定要作廢發票 ${invoiceNumber} 嗎？`,
      data: {
        invoiceNumber: invoiceNumber
      },
      onConfirm: async () => {
        this.eventBus.emit(EVENTS.PROCESS.INVOICE_VOIDING, {
          orderNo,
          timestamp: new Date().toISOString()
        });

        const platformName =
          invoice.provider || invoice.platform || this.state.currentPlatform;
        if (!platformName) {
          return;
        }

        try {
          let platform = this.platforms[platformName];
          if (!platform) {
            platform = await this.app.loadPlatform(platformName);
          }

          const platformConfig =
            await this.dataEngine.getPlatformConfig(platformName);
          const result = await platform.handleVoid({
            invoiceNumber,
            reason: '作廢',
            testMode: this.state.isTestMode,
            platform_config: platformConfig,
            category: invoice.category,
            buyer_ubn: invoice.buyer_ubn,
            invoiceDate: invoice.invoiceDate
          });

          if (!result?.success) {
            this.eventBus.emit(EVENTS.ERROR.PROCESSING_FAILED, {
              action: 'void_invoice',
              orderNo,
              error: result?.error || 'void_failed'
            });
            return;
          }

          this.dataEngine.updateInvoiceStatus(orderNo, 'voided', {
            invoiceNumber: result.invoiceNumber || invoiceNumber,
            voidTime: result.voidTime || new Date().toISOString()
          });

          this.eventBus.emit(EVENTS.PROCESS.INVOICE_VOIDED, {
            orderNo,
            invoiceNumber: result.invoiceNumber || invoiceNumber
          });
        } catch (error) {
          this.eventBus.emit(EVENTS.ERROR.PROCESSING_FAILED, {
            action: 'void_invoice',
            orderNo,
            error: error.message
          });
        }
      }
    });
  }

  async getPlatformConfig(platform) {
    if (this.dataEngine && this.dataEngine.getPlatformConfig) {
      return await this.dataEngine.getPlatformConfig(platform);
    }
    return null;
  }

  updateUIState(partialState) {
    if (!partialState || typeof partialState !== 'object') return;

    Object.keys(partialState).forEach((key) => {
      if (this.state.hasOwnProperty(key)) {
        this.state[key] = partialState[key];
      }
    });

    if (partialState.hasOwnProperty('isScrolled')) {
      this.handleScrollStateUpdate();
    }

    if (partialState.hasOwnProperty('dataSourceValue')) {
    }
  }

}

function normalizeCredentials(creds) {
  if (!creds || typeof creds !== 'object') return null;

  if (Object.keys(creds).length === 0) return null;

  const hasValidValue = Object.entries(creds).some(([key, value]) => {
    return value && typeof value === 'string' && !isPlaceholder(value);
  });

  return hasValidValue ? creds : null;
}

function isPlaceholder(value) {
  if (!value || typeof value !== 'string') return true;

  const placeholderPatterns = [/^YOUR_/i, /^XXX+$/, /^000+$/, /^\s*$/];

  return placeholderPatterns.some((pattern) => pattern.test(value));
}
