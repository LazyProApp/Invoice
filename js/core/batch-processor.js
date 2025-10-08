import { EVENTS } from './events.js';

export class BatchProcessor {
  constructor(eventBus, dataEngine, invoiceCore) {
    this.eventBus = eventBus;
    this.dataEngine = dataEngine;
    this.invoiceCore = invoiceCore;
    this.state = {
      currentBatchId: null,
      isPaused: false,
      isProcessing: false,
      currentOrderNo: null,
      hasProcessingInvoice: false,
      stats: {
        total: 0,
        processed: 0,
        successful: 0,
        failed: 0,
        skipped: 0
      }
    };

    this.setupEventListeners();
    this.resetState();
  }

  resetState() {
    this.state.currentBatchId = null;
    this.state.isPaused = false;
    this.state.isProcessing = false;
    this.state.currentOrderNo = null;
    this.state.hasProcessingInvoice = false;
    this.resetStats();
  }

  setupEventListeners() {
    this.eventBus.on(EVENTS.PROCESS.PROGRESS_UPDATE, (data) => {
      this.handleProgressUpdate(data);
    });
  }

  async startBatch(platform, options = {}) {
    this.eventBus.emit(EVENTS.PROCESS.BATCH_STARTED, {
      platform,
      testMode: options.testMode,
      timestamp: new Date().toISOString()
    });

    try {
      this.state.currentBatchId = Date.now().toString();
      this.state.isPaused = false;
      this.resetStats();

      const invoices = this.dataEngine.getInvoicesSnapshot();


      this.state.stats.total = invoices.length;

      if (invoices.length === 0) {
        throw new Error('沒有可處理的發票資料');
      }

      await this.processBatchInvoices(invoices, platform, options);

      this.completeBatch();
      return { success: true, stats: this.state.stats };
    } catch (error) {
      this.eventBus.emit(EVENTS.PROCESS.BATCH_ABORTED, {
        batchId: this.state.currentBatchId,
        reason: 'Processing error',
        error: error.message,
        timestamp: new Date().toISOString()
      });
      return { success: false, error: error.message };
    }
  }

  stopBatch() {
    this.state.hasProcessingInvoice = false;
    this.state.isPaused = true;

    this.eventBus.emit(EVENTS.PROCESS.BATCH_PAUSED, {
      batchId: this.state.currentBatchId,
      hasProcessingInvoice: false,
      stats: this.state.stats,
      timestamp: new Date().toISOString()
    });
  }

  updateRowToProcessing(orderNo, index) {
    this.eventBus.emit(EVENTS.PROCESS.ROW_PROCESSING, {
      orderNo,
      index,
      batchId: this.state.currentBatchId,
      status: 'processing'
    });
  }

  updateRowToSuccess(orderNo, invoiceNumber) {
    this.eventBus.emit(EVENTS.PROCESS.ROW_SUCCESS, {
      orderNo,
      invoiceNumber,
      batchId: this.state.currentBatchId,
      status: 'success'
    });
  }

  updateRowToFailed(orderNo, errorMessage) {
    this.eventBus.emit(EVENTS.PROCESS.ROW_FAILED, {
      orderNo,
      error: errorMessage,
      batchId: this.state.currentBatchId,
      status: 'failed'
    });
  }

  completeBatch() {
    this.state.hasProcessingInvoice = false;
    this.state.isProcessing = false;

    this.eventBus.emit(EVENTS.PROCESS.BATCH_COMPLETED, {
      batchId: this.state.currentBatchId,
      hasProcessingInvoice: false,
      stats: this.state.stats,
      timestamp: new Date().toISOString()
    });
  }

  shouldSkipInvoice(invoice) {
    const status = invoice._status;
    const orderNo = invoice.merchant_order_no;

    if (status === 'success' || status === 'voided') {
      return true;
    }

    return false;
  }

  resetStats() {
    this.state.stats = {
      total: 0,
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0
    };
  }

  emitProgress() {
    this.eventBus.emit(EVENTS.PROCESS.PROGRESS_UPDATE, {
      batchId: this.state.currentBatchId,
      percentage: Math.round(
        (this.state.stats.processed / this.state.stats.total) * 100
      ),
      current: this.state.stats.processed,
      total: this.state.stats.total,
      successful: this.state.stats.successful,
      failed: this.state.stats.failed,
      skipped: this.state.stats.skipped
    });
  }


  async processBatchInvoices(invoices, platform, options) {
    for (let i = 0; i < invoices.length; i++) {
      if (this.state.isPaused) {
        break;
      }

      const invoice = invoices[i];
      const orderNo = invoice.merchant_order_no;

      if (this.shouldSkipInvoice(invoice)) {
        this.state.stats.skipped++;
        this.state.stats.processed++;
        this.emitProgress();
        continue;
      }

      this.state.isProcessing = true;
      this.state.currentOrderNo = orderNo;
      this.state.hasProcessingInvoice = true;
      this.updateRowToProcessing(orderNo, i);

      try {
        const result = await this.invoiceCore.processInvoice(invoice, {
          platform,
          testMode: options.testMode,
          batchId: this.state.currentBatchId
        });

        if (result.success) {
          this.dataEngine.updateInvoice(orderNo, {
            _status: 'success',
            invoiceNumber: result.invoiceNumber,
            randomNumber: result.randomNumber,
            createTime: result.createTime
          });

          this.updateRowToSuccess(orderNo, result.invoiceNumber);
          this.state.stats.successful++;
        } else {
          this.dataEngine.updateInvoice(orderNo, {
            _status: 'failed',
            _error: result.error
          });

          this.updateRowToFailed(orderNo, result.error);
          this.state.stats.failed++;
        }
      } catch (error) {
        this.dataEngine.updateInvoice(orderNo, {
          _status: 'failed',
          _error: error.message
        });

        this.updateRowToFailed(orderNo, error.message);
        this.state.stats.failed++;
      } finally {
        this.state.isProcessing = false;
        this.state.currentOrderNo = null;
      }

      this.state.stats.processed++;
      this.emitProgress();
    }
  }
}
