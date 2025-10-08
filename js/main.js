/**
 * Main Module
 * Application entry point and initialization
 */

import { EventBus } from './core/event-bus.js';
import { InvoiceCore } from './core/invoice.js';
import { DataEngine } from './core/data-engine.js';
import { Controller } from './core/controller.js';
import { EVENTS } from './core/events.js';

import { UIHandlers } from './ui/handlers.js';
import { DialogManager } from './ui/dialogs.js';
import { FormHandler } from './ui/forms.js';
import { TableManager } from './ui/table.js';
import { ItemManager } from './ui/items.js';
import { StatisticsManager } from './ui/statistics.js';
import { PlatformMenuHandler } from './ui/platform-menu.js';

import { BatchProcessor } from './core/batch-processor.js';
import { ExportManager } from './core/export-manager.js';

class LazyInvoiceApp {
  constructor() {
    this.isInitialized = false;
    this.state = {
      isProcessing: false,
      hasUploadedFile: false,
      isTestMode: false,
      currentPlatform: 'ecpay',
      demoInvoicesData: {}
    };

    this.eventBus = null;
    this.dataEngine = null;
    this.invoice = null;
    this.controller = null;

    this.platforms = {};
    this.loadedPlatforms = new Set();

    this.ui = null;
    this.dialog = null;
    this.form = null;
    this.table = null;
    this.items = null;
    this.statistics = null;
    this.platformMenuHandler = null;
    this.batchProcessor = null;
    this.exportManager = null;
  }

  async initialize() {
    this.initializeCore();
    await this.registerPlatforms();
    this.initializeUI();
    this.initializeManagers();
    this.initializeController();

    this.isInitialized = true;
  }

  initializeCore() {
    this.eventBus = new EventBus();

    this.dataEngine = new DataEngine(this.eventBus);
    this.invoice = new InvoiceCore(this.eventBus, this.dataEngine);

    if (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
    ) {
      this.invoice.enableDebugMode();
    }
  }

  async registerPlatforms() {
    const allPlatforms = ['ezpay', 'ecpay', 'opay', 'smilepay', 'amego'];

    try {
      for (const platform of allPlatforms) {
        await this.loadPlatform(platform);
      }
    } catch (error) {
      throw error;
    }
  }

  initializeUI() {
    const uiDomElements = {
      actionBtn: document.getElementById('actionBtn'),
      actionBtnText: document.getElementById('actionBtnText'),
      actionBtnOutlined: document.getElementById('actionBtnOutlined'),
      dataSourceInput: document.getElementById('dataSourceInput'),
      previewSection: document.getElementById('previewSection'),
      invoiceTableBody: document.getElementById('invoiceTableBody'),
      statsSection: document.getElementById('statsSection')
    };


    const dialogDom = {
      editDialog: document.getElementById('editDialog'),
      categoryMenuButton: document.getElementById('categoryMenuButton'),
      categoryMenu: document.getElementById('categoryMenu'),
      invoiceProcessingSelect: document.getElementById('editInvoiceProcessing'),
      addItemBtn: document.getElementById('addItemBtn'),
      itemsList: document.getElementById('itemsList'),
      processingInput: document.getElementById('editProcessingInput')
    };

    this.form = new FormHandler(
      this.eventBus,
      this.dataEngine,
      {},
      this.platforms
    );

    this.dialog = new DialogManager(
      this.eventBus,
      dialogDom,
      this.dataEngine,
      this.form,
      this.controller
    );

    const tableDom = {
      invoiceTableBody: document.getElementById('invoiceTableBody'),
      invoiceTable: document.getElementById('invoiceTable'),
      emptyState: document.getElementById('emptyState')
    };
    this.table = new TableManager(this.eventBus, tableDom, this.dataEngine);

    const statisticsDom = {
      totalCount: document.getElementById('totalCount'),
      successCount: document.getElementById('successCount'),
      failedCount: document.getElementById('failedCount')
    };
    this.statistics = new StatisticsManager(
      statisticsDom,
      this.eventBus,
      this.dataEngine
    );
    this.table.statisticsManager = this.statistics;

    this.ui = new UIHandlers(
      this.eventBus,
      uiDomElements,
      this.dataEngine,
      this.table,
      this.statistics,
      this.dialog
    );

    const domElements = {
      itemsList: document.getElementById('itemsList')
    };
    this.items = new ItemManager(domElements, this.dialog, this.eventBus);

    this.dialog.itemManager = this.items;

    this.form.itemManager = this.items;

    this.dialog.initializeDialogs();

    this.platformMenuHandler = new PlatformMenuHandler(
      this.eventBus,
      this.dialog,
      this.dataEngine
    );

    this.ui.bindEvents();
  }

  initializeController() {
    this.controller = new Controller(
      this.eventBus,
      this.dataEngine,
      this.platforms,
      this.table,
      this.statistics,
      this.dialog,
      this.form,
      this.ui,
      this,
      this.exportManager
    );

    this.setupAppEventListeners();

    if (this.form && this.form.setController) {
      this.form.setController(this.controller);
    }


    if (this.ui) {
      this.ui.controller = this.controller;
      if (!this.ui.dialogManager) {
        this.ui.dialogManager = this.dialog;
      }
    }

    const platformInstance = this.platforms[this.state.currentPlatform];
    const displayName = platformInstance?.displayName || this.state.currentPlatform;

    this.eventBus.emit(EVENTS.APP_EVENTS.PLATFORM_CHANGED, {
      platform: this.state.currentPlatform,
      displayName: displayName,
      source: 'initialization',
      timestamp: new Date().toISOString()
    });

    if (this.dialog) {
      this.dialog.controller = this.controller;
    }

    if (this.ui) {
      this.ui.controller = this.controller;
    }

    if (this.ui && this.statistics) {
      this.ui.statisticsManager = this.statistics;
    }
  }

  initializeManagers() {
    this.batchProcessor = new BatchProcessor(
      this.eventBus,
      this.dataEngine,
      this.invoice
    );

    this.exportManager = new ExportManager(this.eventBus, this.dataEngine);
  }

  setupAppEventListeners() {
    this.eventBus.on(EVENTS.APP_EVENTS.PLATFORM_CHANGED, (data) => {
      this.handlePlatformChange(data.platform);
    });

    this.eventBus.on(EVENTS.APP_EVENTS.TEST_MODE_TOGGLED, (data) => {
      const isTestMode =
        typeof data.isTestMode === 'boolean'
          ? data.isTestMode
          : Boolean(data.enabled);
      this.handleTestModeToggle(isTestMode);
    });

    this.eventBus.on(EVENTS.COMMAND.START_BATCH, async (data) => {
      await this.handleProcessStart(data);
    });

    this.eventBus.on(EVENTS.COMMAND.STOP_BATCH, () => {
      this.handleProcessStop();
    });

    this.eventBus.on(EVENTS.PROCESS.BATCH_STARTED, () => {
      if (this.ui && this.ui.updateProcessingState) {
        this.ui.updateProcessingState(true);
      }
    });

    this.eventBus.on(EVENTS.PROCESS.BATCH_COMPLETED, () => {
      if (this.ui && this.ui.updateProcessingState) {
        this.ui.updateProcessingState(false);
      }
    });

    this.eventBus.on(EVENTS.PROCESS.BATCH_ABORTED, () => {
      if (this.ui && this.ui.updateProcessingState) {
        this.ui.updateProcessingState(false);
      }
    });
  }

  async loadInitialDemoData() {
    const response = await fetch('./invoice-templates/ecpay.json');
    if (!response.ok) {
      return;
    }

    const data = await response.json();

    if (data.test || data.production) {
      this.state.demoInvoicesData = {
        provider: data.provider,
        credentials: data
      };
    }

    this.eventBus.emit(EVENTS.COMMAND.UPLOAD_FILE, {
      file: {
        name: 'ecpay-demo.json',
        content: JSON.stringify(data),
        type: 'demo'
      },
      source: 'demo_template',
      timestamp: new Date().toISOString()
    });
  }


  async handlePlatformChange(platform) {
    const platformInstance = await this.loadPlatform(platform);

    this.state.currentPlatform = platform;
  }

  handleTestModeToggle(isTestMode) {
    this.state.isTestMode = Boolean(isTestMode);

    if (this.ui && this.ui.updateTestModeUI) {
      this.ui.updateTestModeUI(this.state.isTestMode);
    }
  }

  async handleProcessStart(data) {
    const finalTestMode =
      typeof data?.testMode === 'boolean'
        ? data.testMode
        : Boolean(this.controller.getState('isTestMode'));

    if (this.batchProcessor) {
      const result = await this.batchProcessor.startBatch(
        data?.platform || this.state.currentPlatform,
        {
          testMode: finalTestMode
        }
      );

      if (!result.success) {
      }
    }
  }

  handleProcessStop() {
    if (this.batchProcessor) {
      this.batchProcessor.stopBatch();
    }
  }

  handleFileSelected(data) {
    this.state.hasUploadedFile = true;
  }

  async handleFileUpload() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput?.files[0];

    if (!file) {
      return;
    }

  }

  async loadPlatform(name) {
    if (this.platforms[name]) {
      return this.platforms[name];
    }

    const platformMap = {
      ezpay: () => import('./modules/ezpay/index.js'),
      ecpay: () => import('./modules/ecpay/index.js'),
      opay: () => import('./modules/opay/index.js'),
      smilepay: () => import('./modules/smilepay/index.js'),
      amego: () => import('./modules/amego/index.js')
    };

    if (!platformMap[name]) {
      throw new Error(`Unknown platform: ${name}`);
    }

    try {
      const module = await platformMap[name]();
      const platformClassName = `${name.charAt(0).toUpperCase()}${name.slice(1)}Platform`;
      const PlatformClass = module[platformClassName];

      if (!PlatformClass) {
        throw new Error(
          `Platform class ${platformClassName} not found in module`
        );
      }

      this.platforms[name] = new PlatformClass({
        eventBus: this.eventBus,
        dataEngine: this.dataEngine
      });

      this.loadedPlatforms.add(name);

      return this.platforms[name];
    } catch (error) {
      throw new Error(`Failed to load platform ${name}: ${error.message}`);
    }
  }

  async getCurrentPlatform() {
    if (!this.platforms[this.state.currentPlatform]) {
      await this.loadPlatform(this.state.currentPlatform);
    }
    return this.platforms[this.state.currentPlatform];
  }

  isPlatformLoaded(name) {
    return this.loadedPlatforms.has(name);
  }

  getLoadedPlatforms() {
    return Array.from(this.loadedPlatforms);
  }

  destroy() {
    if (this.ui) this.ui.destroy?.();

    this.isInitialized = false;
  }
}

document.addEventListener('DOMContentLoaded', async function () {
  const dataSourceInput = document.getElementById('dataSource');
  if (dataSourceInput) {
    dataSourceInput.value = '';
  }

  const app = new LazyInvoiceApp();


  await app.initialize();

  window.addEventListener('beforeunload', function () {
    app.destroy();
  });
});

export default LazyInvoiceApp;
