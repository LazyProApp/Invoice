/**
 * InvoiceCore Module
 * Core invoice business logic and operations
 */

import { EVENTS } from './events.js';

export class InvoiceCore {
  constructor(eventBus, dataEngine) {
    this.eventBus = eventBus;
    this.dataEngine = dataEngine;
    this.debugMode = false;
    this.abortProcessing = false;
  }

  enableDebugMode() {
    this.debugMode = true;
  }


  async create(data, platform) {
    try {

      if (!data || !platform) {
        throw new Error('Missing required parameters: data and platform');
      }

      if (!data.merchant_order_no) {
        data.merchant_order_no = this.dataEngine.generateOrderNo();
      }

      this.eventBus.emit(EVENTS.PROCESS.ROW_PROCESSING, {
        platform,
        data,
        action: 'creating'
      });

      this.eventBus.emit(EVENTS.PLATFORM.INVOICE_CREATING, { data, platform });

      return {
        success: true,
        orderNo: data.merchant_order_no,
        platform,
        data
      };
    } catch (error) {
      const errorMsg = 'Failed to create invoice: ' + error.message;


      return {
        success: false,
        error: errorMsg,
        platform
      };
    }
  }

  async void(invoiceNo, reason, platform) {
    try {

      if (!invoiceNo || !reason || !platform) {
        throw new Error('Invoice number, reason, and platform are required');
      }

      this.eventBus.emit(EVENTS.PLATFORM.INVOICE_VOIDING, {
        invoiceNo,
        reason,
        platform
      });

      return {
        success: true,
        invoiceNo,
        reason,
        platform
      };
    } catch (error) {
      const errorMsg = 'Failed to void invoice: ' + error.message;


      return {
        success: false,
        error: errorMsg,
        platform
      };
    }
  }

  async query(invoiceNo, platform) {
    try {

      if (!invoiceNo || !platform) {
        throw new Error('Invoice number and platform are required');
      }

      this.eventBus.emit(EVENTS.PLATFORM.INVOICE_QUERYING, {
        invoiceNo,
        platform
      });

      return {
        success: true,
        invoiceNo,
        platform
      };
    } catch (error) {
      const errorMsg = 'Failed to query invoice: ' + error.message;


      return {
        success: false,
        error: errorMsg,
        platform
      };
    }
  }

  async allowance(data, platform) {
    try {

      if (!data || !platform) {
        throw new Error('Allowance data and platform are required');
      }

      this.eventBus.emit(EVENTS.PLATFORM.INVOICE_ALLOWANCE, { data, platform });

      return {
        success: true,
        data,
        platform
      };
    } catch (error) {
      const errorMsg = 'Failed to create allowance: ' + error.message;


      return {
        success: false,
        error: errorMsg,
        platform
      };
    }
  }

  async processSequential(invoices, platform, options = {}) {
    const {
      signal,
      testMode = false,
      batchId = this.generateBatchId()
    } = options;

    this.abortProcessing = false;
    
    const results = [];
    let successful = 0;
    let failed = 0;

    try {
      this.eventBus.emit(EVENTS.PROCESS.BATCH_STARTED, {
        batchId,
        platform,
        total: invoices.length,
        testMode
      });

      for (let i = 0; i < invoices.length; i++) {
        if (this.abortProcessing || signal?.aborted) {
          this.eventBus.emit(EVENTS.PROCESS.BATCH_ABORTED, {
            batchId,
            reason: 'User aborted',
            processed: i,
            successful,
            failed
          });
          break;
        }

        const invoice = invoices[i];
        const orderNo = invoice.merchant_order_no || this.dataEngine.generateOrderNo();

        this.eventBus.emit(EVENTS.PROCESS.PROGRESS_UPDATE, {
          batchId,
          current: i + 1,
          total: invoices.length,
          orderNo,
          status: 'processing'
        });

        try {
          const result = await this.processInvoice(invoice, {
            signal,
            testMode,
            batchId,
            platform
          });

          if (!signal?.aborted) {
            if (result.success) {
              successful++;
              results.push({
                success: true,
                orderNo,
                data: result,
                index: i
              });

              this.eventBus.emit(EVENTS.PROCESS.ROW_SUCCESS, {
                batchId,
                orderNo,
                invoiceNumber: result.invoiceNumber,
                platform
              });
            } else {
              failed++;
              results.push({
                success: false,
                orderNo,
                error: result.error,
                index: i
              });

              this.eventBus.emit(EVENTS.PROCESS.ROW_FAILED, {
                batchId,
                orderNo,
                error: result.error,
                platform
              });
            }
          }
        } catch (error) {
          if (error.name !== 'AbortError' && !signal?.aborted) {
            failed++;
            results.push({
              success: false,
              orderNo,
              error: error.message,
              index: i
            });

            this.eventBus.emit(EVENTS.PROCESS.ROW_FAILED, {
              batchId,
              orderNo,
              error: error.message,
              platform
            });
          }
        }
      }

      if (!signal?.aborted) {
        this.eventBus.emit(EVENTS.PROCESS.BATCH_COMPLETED, {
          batchId,
          platform,
          total: invoices.length,
          successful,
          failed,
          results
        });
      }

      return results;
    } catch (error) {
      this.eventBus.emit(EVENTS.PROCESS.BATCH_ABORTED, {
        batchId,
        reason: error.message,
        successful,
        failed
      });

      throw error;
    }
  }

  async processInvoice(invoice, options = {}) {
    const { platform, testMode, batchId } = options;

    if (!invoice || !platform) {
      throw new Error('Invoice data and platform are required');
    }

    const platformConfig = await this.dataEngine.getPlatformConfig(platform);
    if (!platformConfig) {
      throw new Error(`缺少 ${platform} 平台憑證`);
    }

    const credentials = testMode ? platformConfig.test : platformConfig.production;
    if (!credentials) {
      throw new Error(`缺少 ${platform} ${testMode ? '測試' : '正式'} 環境憑證`);
    }

    try {
      const PlatformModule = await import(`../modules/${platform}/index.js`);
      const platformClass = `${platform.charAt(0).toUpperCase() + platform.slice(1)}Platform`;
      const platformInstance = new PlatformModule[platformClass](this);
      
      const processData = {
        ...invoice,
        testMode,
        platform_config: platformConfig
      };
      
      const result = await platformInstance.functions.create.process(processData);
      
      this.eventBus.emit(EVENTS.PLATFORM.INVOICE_CREATED, {
        ...result,
        platform,
        batchId
      });
      
      return result;
    } catch (error) {
      throw error;
    }
  }

  generateBatchId() {
    return `batch_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }


  validateInvoiceData(data) {
    const errors = [];

    if (!data) {
      errors.push('Invoice data is required');
      return { valid: false, errors };
    }

    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
      errors.push('At least one item is required');
    }

    if (data.items) {
      data.items.forEach((item, index) => {
        if (!item.name || item.name.trim() === '') {
          errors.push(`Item ${index + 1}: name is required`);
        }
        if (!item.price || isNaN(parseFloat(item.price))) {
          errors.push(`Item ${index + 1}: valid price is required`);
        }
        if (!item.quantity || isNaN(parseInt(item.quantity))) {
          errors.push(`Item ${index + 1}: valid quantity is required`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  calculateTotal(items) {
    if (!Array.isArray(items)) return 0;

    return items.reduce((total, item) => {
      const price = parseFloat(item.price) || 0;
      const quantity = parseInt(item.quantity) || 0;
      return total + price * quantity;
    }, 0);
  }
}
