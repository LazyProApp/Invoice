/**
 * SmilePay Platform Module
 * SmilePay invoice processing implementation
 */

import { SmilepayCrypto } from './crypto.js';
import { SmilepayCarrierProvider } from './carrier.js';
import { SmilepayCreateFunction } from './functions/create.js';
import { SmilepayVoidFunction } from './functions/void.js';
import { EVENTS } from '../../core/events.js';

export class SmilepayPlatform {
  constructor(core) {
    this.crypto = new SmilepayCrypto();
    this.carrierProvider = new SmilepayCarrierProvider();
    this.eventBus = core.eventBus;

    this.name = 'smilepay';
    this.displayName = 'SmilePay';

    this.credentials = {
      test: null,
      production: null
    };

    this.functions = {
      create: new SmilepayCreateFunction(this),
      void: new SmilepayVoidFunction(this)
    };

    if (core.dataEngine) {
      core.dataEngine.registerCarrierProvider(this.name, this.carrierProvider);
    }

    this.setupEventListeners();
  }

  setupEventListeners() {
    this.eventBus.on(EVENTS.PLATFORM.INVOICE_CREATING, async (data) => {
      if (data.platform === this.name) {
        await this.handleInvoiceCreation(data);
      }
    });

    this.eventBus.on(EVENTS.PLATFORM.CREDENTIALS_LOADED, (data) => {
      if (data.provider === this.name) {
        this.handleCredentialsLoaded(data);
      }
    });

    this.eventBus.on(EVENTS.PLATFORM.CREDENTIALS_REQUESTED, (data) => {
      if (data.provider === this.name) {
        this.handleCredentialsRequested(data);
      }
    });
  }

  async handleInvoiceCreation(eventData) {
    try {
      const result = await this.functions.create.process(eventData.data);
      this.eventBus.emit(EVENTS.PLATFORM.INVOICE_CREATED, {
        platform: this.name,
        result
      });
    } catch (error) {
      this.eventBus.emit(EVENTS.PLATFORM.INVOICE_ERROR, {
        platform: this.name,
        error: error.message
      });
    }
  }

  async handleVoid(data) {
    return await this.functions.void.process(data);
  }

  handleCredentialsLoaded({ provider, production, test, source }) {
    this.credentials.test = test || null;
    this.credentials.production = production || null;
  }

  handleCredentialsRequested({ provider, mode, timestamp }) {
    let valid = false;
    let missingFields = [];

    const credentials = this.credentials[mode];

    if (!credentials) {
      missingFields.push(`${mode}_credentials`);
    } else if (typeof credentials === 'object' && Object.keys(credentials).length > 0) {
      const requiredFields = ['grvc', 'verify_key'];
      const missingRequired = requiredFields.filter(field => !credentials[field]);

      if (missingRequired.length === 0) {
        valid = true;
      } else {
        missingFields = missingRequired;
      }
    } else {
      missingFields.push(`${mode}_credentials`);
    }

    this.eventBus.emit(EVENTS.PLATFORM.CREDENTIALS_RESPONSE, {
      provider,
      mode,
      valid,
      missingFields: missingFields.length > 0 ? missingFields : undefined,
      timestamp: new Date().toISOString()
    });
  }

  getCarrierConfig(category) {
    return this.carrierProvider.getCarrierConfig(category);
  }

  getCarrierDescription(type) {
    return this.carrierProvider.describeCarrier(type);
  }

  getCarrierProvider() {
    return this.carrierProvider;
  }

  transformCarrierData({ category, processingType, processingInput }) {
    if (category === 'B2B') {
      return {
        carrier_type: '',
        carrier_num: '',
        love_code: '',
        print_flag: 'Y',
        kiosk_print_flag: ''
      };
    }

    if (processingType === 'donate') {
      return {
        carrier_type: '',
        carrier_num: '',
        love_code: processingInput || '',
        print_flag: 'N',
        kiosk_print_flag: ''
      };
    } else if (processingType === 'print' || !processingType) {
      return {
        carrier_type: '',
        carrier_num: '',
        love_code: '',
        print_flag: 'Y',
        kiosk_print_flag: ''
      };
    } else {
      return {
        carrier_type: processingType,
        carrier_num: processingInput || '',
        love_code: '',
        print_flag: 'N',
        kiosk_print_flag: ''
      };
    }
  }
}
