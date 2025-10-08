/**
 * FormHandler Module
 * Form data processing and validation
 */

import { Utils } from './utils.js';
import { EVENTS } from '../core/events.js';

class FormHandler {
  constructor(eventBus, dataEngine = null, errorHandlers = {}, platforms = {}) {
    this.eventBus = eventBus;
    this.dataEngine = dataEngine;
    this.platforms = platforms;
    this.itemManager = null;
    this.originalInvoiceData = null;

    this.dom = {
      get categoryInput() {
        return document.getElementById('categoryMenuButton');
      },
      get categoryText() {
        return document.getElementById('categoryText');
      },
      get editCategory() {
        return document.getElementById('editCategory');
      },
      get b2bBasicFields() {
        return document.getElementById('b2bBasicFields');
      },
      get b2cBasicFields() {
        return document.getElementById('b2cBasicFields');
      },
      get b2cOnlyFields() {
        return document.getElementById('b2cOnlyFields');
      },
      get itemsList() {
        return document.getElementById('itemsList');
      },
      get editTaxRate() {
        return document.getElementById('editTaxRate');
      },
      get taxRateField() {
        return document.getElementById('editTaxRate');
      },
      get customsClearanceField() {
        return document.getElementById('customsClearanceField');
      },
      get kioskPrintField() {
        return document.getElementById('kioskPrintField');
      },
      get processingInput() {
        return document.getElementById('editProcessingInput');
      },
      get carrierNumField() {
        return document.getElementById('editCarrierNum');
      },
      get buyerEmailField() {
        return document.getElementById('editBuyerEmailB2C');
      },
      get mixedTaxBreakdown() {
        return null;
      }
    };

  }

  setOriginalInvoiceData(data) {
    this.originalInvoiceData = data;
  }

  getOriginalInvoiceData() {
    return this.originalInvoiceData;
  }

  validateField(field) {
    if (!field.checkValidity()) {
      field.error = true;
      return false;
    } else {
      field.error = false;
      return true;
    }
  }

  requestCarrierTransformation = async (category) => {
    const processingType =
      document.getElementById('editInvoiceProcessing')?.value || '';
    const processingInput =
      document.getElementById('editProcessingInput')?.value || '';

    const currentPlatform = this.controller?.getCurrentPlatform();
    const platform = currentPlatform && this.platforms[currentPlatform];

    if (platform && typeof platform.transformCarrierData === 'function') {
      const transformed = await platform.transformCarrierData({
        category,
        processingType,
        processingInput
      });
      if (transformed) {
        return transformed;
      }
    }

    return this.getBasicCarrierData(category, processingType, processingInput);
  };

  getBasicCarrierData = (category, processingType, processingInput) => {
    if (category === 'B2B') {
      return {
        carrier_type: '',
        carrier_num: '',
        love_code: '',
        print_flag: 'Y',
        kiosk_print_flag: ''
      };
    } else {
      if (processingType === 'donate') {
        return {
          carrier_type: '',
          carrier_num: '',
          love_code: processingInput,
          print_flag: 'N',
          kiosk_print_flag: ''
        };
      } else if (processingType === 'print' || !processingType) {
        return {
          carrier_type: '',
          carrier_num: '',
          love_code: '',
          print_flag: processingType === 'print' ? 'Y' : 'N',
          kiosk_print_flag: ''
        };
      } else {
        return {
          carrier_type: processingType,
          carrier_num: processingInput,
          love_code: '',
          print_flag: 'N',
          kiosk_print_flag: ''
        };
      }
    }
  };

  handleCategoryChange = (category) => {
    const categoryText = this.dom.categoryText;
    const categoryInput = document.getElementById('editCategory');

    if (categoryText) {
      categoryText.textContent = category;
    }
    if (categoryInput) {
      categoryInput.value = category;
    }

    const b2bBasicFields = this.dom.b2bBasicFields;
    const b2cBasicFields = this.dom.b2cBasicFields;
    const b2cOnlyFields = this.dom.b2cOnlyFields;

    const { taxType: taxTypeSelect } = Utils.getActiveTaxElements();
    if (taxTypeSelect) {
      const mixedTaxOption = taxTypeSelect.querySelector(
        'md-select-option[value="9"]'
      );

      if (category === 'B2B') {
        if (mixedTaxOption) {
          mixedTaxOption.disabled = true;
          mixedTaxOption.style.display = 'none';
        }

        if (taxTypeSelect.value === '9') {
          taxTypeSelect.value = '1';
          taxTypeSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
      } else {
        if (mixedTaxOption) {
          mixedTaxOption.disabled = false;
          mixedTaxOption.style.display = '';
        }
      }
    }

    if (category === 'B2B') {
      if (b2bBasicFields) b2bBasicFields.classList.remove('hidden');
      if (b2cBasicFields) b2cBasicFields.classList.add('hidden');
      if (b2cOnlyFields) b2cOnlyFields.classList.add('hidden');
    } else {
      if (b2bBasicFields) b2bBasicFields.classList.add('hidden');
      if (b2cBasicFields) b2cBasicFields.classList.remove('hidden');
      if (b2cOnlyFields) b2cOnlyFields.classList.remove('hidden');
    }

    if (this.originalInvoiceData) {
      this.fillFieldsFromOriginalData(category);
    }

    this.eventBus.emit(EVENTS.FORM.CATEGORY_CHANGED, { category });
  };

  getFormData = async () => {
    const category = this.dom.categoryInput?.value || 'B2B';

    let buyer_name,
      buyer_email,
      buyer_phone,
      buyer_address,
      merchant_order_no,
      buyer_ubn;

    if (category === 'B2B') {
      buyer_name = document.getElementById('editBuyerName')?.value || '';
      buyer_ubn = document.getElementById('editBuyerUBN')?.value || '';
      buyer_email = document.getElementById('editBuyerEmail')?.value || '';
      buyer_phone = document.getElementById('editBuyerPhone')?.value || '';
      buyer_address = document.getElementById('editBuyerAddress')?.value || '';
      merchant_order_no =
        this.originalInvoiceData?.merchant_order_no ||
        document.getElementById('editMerchantOrderNo')?.value ||
        this.dataEngine.generateOrderNo();
    } else {
      buyer_name = document.getElementById('editBuyerNameB2C')?.value || '';
      buyer_ubn = '';
      buyer_email = document.getElementById('editBuyerEmailB2C')?.value || '';
      buyer_phone = document.getElementById('editBuyerPhoneB2C')?.value || '';
      buyer_address =
        document.getElementById('editBuyerAddressB2C')?.value || '';
      merchant_order_no =
        this.originalInvoiceData?.merchant_order_no ||
        document.getElementById('editMerchantOrderNoB2C')?.value ||
        this.dataEngine.generateOrderNo();
    }

    const carrierData = await this.requestCarrierTransformation(category);

    const taxType = document.getElementById('editTaxType')?.value || '1';
    const calculatedAmounts = this.itemManager?.getCalculatedAmounts() || {};

    const baseData = {
      category: category,
      buyer_name: buyer_name,
      buyer_ubn: buyer_ubn,
      buyer_email: buyer_email,
      merchant_order_no: merchant_order_no,
      buyer_phone: buyer_phone,
      buyer_address: buyer_address,
      tax_type: taxType,
      tax_rate: parseFloat(document.getElementById('editTaxRate')?.value || 5),

      carrier_type: carrierData.carrier_type,
      carrier_num: carrierData.carrier_num,
      love_code: carrierData.love_code,
      print_flag: carrierData.print_flag,
      kiosk_print_flag: carrierData.kiosk_print_flag,

      invoice_processing:
        document.getElementById('editInvoiceProcessing')?.value || '',
      processing_input:
        document.getElementById('editProcessingInput')?.value || '',

      customs_clearance:
        document.getElementById('editCustomsClearance')?.checked || false,
      comment: document.getElementById('editComment')?.value || '',

      items: this.itemManager?.getEditFormItems() || []
    };

    let finalData;
    if (taxType === '9') {
      finalData = {
        ...baseData,
        amt: calculatedAmounts.amt || 0,
        sales_amount: calculatedAmounts.sales_amount || 0,
        zero_tax_sales_amount: calculatedAmounts.zero_tax_sales_amount || 0,
        free_tax_sales_amount: calculatedAmounts.free_tax_sales_amount || 0,
        tax_amt: calculatedAmounts.tax_amt || 0,
        total_amt: calculatedAmounts.total_amt || 0
      };
    } else {
      finalData = {
        ...baseData,
        amt: calculatedAmounts.amt || 0,
        tax_amt: calculatedAmounts.tax_amt || 0,
        total_amt: calculatedAmounts.total_amt || 0
      };
    }

    const trimFields = (obj) => {
      const cleaned = {};
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
          cleaned[key] = value.replace(/\s+/g, ' ').trim();
        } else if (Array.isArray(value)) {
          cleaned[key] = value.map(item =>
            typeof item === 'object' ? trimFields(item) : item
          );
        } else {
          cleaned[key] = value;
        }
      }
      return cleaned;
    };

    return trimFields(finalData);
  };

  setupCategoryToggleEvent = () => {
    const categoryToggleButton = document.getElementById('categoryToggleButton');
    if (categoryToggleButton && !categoryToggleButton.hasAttribute('data-toggle-bound')) {
      categoryToggleButton.setAttribute('data-toggle-bound', 'true');

      categoryToggleButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const currentCategory = document.getElementById('editCategory')?.value || 'B2B';
        const newCategory = currentCategory === 'B2B' ? 'B2C' : 'B2B';
        this.handleCategoryChange(newCategory);
      });
    }
  };

  populateEditDialog = (invoiceData) => {
    const categoryText = this.dom.categoryText;
    const categoryInput = this.dom.categoryInput;
    if (invoiceData.category) {
      if (categoryText) {
        const isMobile = window.innerWidth < 640;
        categoryText.textContent = invoiceData.category;
      }
      if (categoryInput) categoryInput.value = invoiceData.category;
    }

    if (!invoiceData.merchant_order_no) {
      invoiceData.merchant_order_no = this.generateMerchantOrderNo();
    }

    let fieldMappings;
    if (invoiceData.category === 'B2B') {
      fieldMappings = [
        ['editBuyerName', 'buyer_name'],
        ['editBuyerUBN', 'buyer_ubn'],
        ['editBuyerEmail', 'buyer_email'],
        ['editMerchantOrderNo', 'merchant_order_no'],
        ['editBuyerPhone', 'buyer_phone'],
        ['editBuyerAddress', 'buyer_address'],
        ['editTaxType', 'tax_type'],
        ['editTaxRate', 'tax_rate'],
        ['editCustomsClearance', 'customs_clearance'],
        ['editComment', 'comment']
      ];
    } else {
      fieldMappings = [
        ['editBuyerNameB2C', 'buyer_name'],
        ['editBuyerEmailB2C', 'buyer_email'],
        ['editBuyerPhoneB2C', 'buyer_phone'],
        ['editBuyerAddressB2C', 'buyer_address'],
        ['editMerchantOrderNoB2C', 'merchant_order_no'],
        ['editTaxType', 'tax_type'],
        ['editTaxRate', 'tax_rate'],
        ['editCustomsClearance', 'customs_clearance'],
        ['editComment', 'comment']
      ];
    }

    fieldMappings.forEach(([fieldId, dataKey]) => {
      const element = document.getElementById(fieldId);
      if (element && invoiceData[dataKey] !== undefined) {
        if (dataKey === 'tax_type') {
          const convertedValue = this.convertApiTaxTypeToUI(
            invoiceData[dataKey],
            invoiceData.customs_clearance
          );
          if (element.tagName === 'MD-OUTLINED-SELECT') {
            element.getUpdateComplete().then(() => {
              if (typeof element.select === 'function') {
                element.select(convertedValue);
              } else {
                element.value = convertedValue;
              }

              element.dispatchEvent(new Event('change', { bubbles: true }));
            });
          } else {
            element.value = convertedValue;
          }
        } else {
          element.value = invoiceData[dataKey];
        }
      }
    });

    const { taxType: taxTypeSelect } = Utils.getActiveTaxElements();
    if (taxTypeSelect) {
      const mixedTaxOption = taxTypeSelect.querySelector(
        'md-select-option[value="9"]'
      );

      if (invoiceData.category === 'B2B') {
        if (mixedTaxOption) {
          mixedTaxOption.disabled = true;
          mixedTaxOption.style.display = 'none';
        }
      } else {
        if (mixedTaxOption) {
          mixedTaxOption.disabled = false;
          mixedTaxOption.style.display = '';
        }
      }
    }

    this.populateEditItems(invoiceData.items || [], invoiceData.tax_type);

    if (invoiceData.category === 'B2C') {
      const invoiceProcessingSelect = document.getElementById(
        'editInvoiceProcessing'
      );
      const processingInput = this.dom.processingInput;

      let savedInputValue = '';

      if (invoiceData.love_code) {
        invoiceProcessingSelect.value = 'donate';
        savedInputValue = invoiceData.love_code;
      } else if (invoiceData.carrier_type) {
        invoiceProcessingSelect.value = invoiceData.carrier_type;
        savedInputValue = invoiceData.carrier_num || '';
      } else {
        invoiceProcessingSelect.value = 'print';
      }

      if (invoiceProcessingSelect) {
        setTimeout(() => {
          const updatedSelect = document.getElementById(
            'editInvoiceProcessing'
          );
          if (updatedSelect) {
            updatedSelect.dispatchEvent(new Event('change'));

            if (savedInputValue) {
              const processingInput = document.getElementById(
                'editProcessingInput'
              );
              if (processingInput) {
                const wasRequired =
                  processingInput.hasAttribute('data-required');
                if (wasRequired) {
                  processingInput.removeAttribute('data-required');
                }

                processingInput.value = savedInputValue;

                if (wasRequired) {
                  processingInput.setAttribute('data-required', 'true');
                }
              }
            }
          }
        }, 100);
      }
    }

    if (invoiceData.category) {
      const categoryText = this.dom.categoryText;
      const categoryInput = this.dom.categoryInput;

      if (categoryText) {
        const isMobile = window.innerWidth < 640;
        categoryText.textContent = invoiceData.category;
      }
      if (categoryInput) categoryInput.value = invoiceData.category;

      const b2bBasicFields = this.dom.b2bBasicFields;
      const b2cBasicFields = this.dom.b2cBasicFields;
      const b2cOnlyFields = this.dom.b2cOnlyFields;

      if (invoiceData.category === 'B2B') {
        if (b2bBasicFields) b2bBasicFields.classList.remove('hidden');
        if (b2cBasicFields) b2cBasicFields.classList.add('hidden');
        if (b2cOnlyFields) b2cOnlyFields.classList.add('hidden');
      } else {
        if (b2bBasicFields) b2bBasicFields.classList.add('hidden');
        if (b2cBasicFields) b2cBasicFields.classList.remove('hidden');
        if (b2cOnlyFields) b2cOnlyFields.classList.remove('hidden');
      }
    }

    setTimeout(() => {
      if (taxTypeSelect) {
        taxTypeSelect.dispatchEvent(new Event('change'));
      }

      if (invoiceData.tax_type === '9' && this.itemManager) {
        const amountsToRestore = {
          amt: invoiceData.amt || 0,
          sales_amount: invoiceData.sales_amount || 0,
          zero_tax_sales_amount: invoiceData.zero_tax_sales_amount || 0,
          free_tax_sales_amount: invoiceData.free_tax_sales_amount || 0,
          tax_amt: invoiceData.tax_amt || 0,
          total_amt: invoiceData.total_amt || 0
        };
        this.itemManager.setCalculatedAmounts(amountsToRestore);
      } else if (this.itemManager) {
        this.itemManager.updateCalculations();
        const amountsToRestore = {
          amt: invoiceData.amt || invoiceData.subtotal || 0,
          tax_amt: invoiceData.tax_amt || 0,
          total_amt: invoiceData.total_amt || 0
        };
        this.itemManager.setCalculatedAmounts(amountsToRestore);
      }
    }, 200);
  };

  clearForm = () => {
    const textFields = [
      'editBuyerName',
      'editBuyerUBN',
      'editBuyerEmail',
      'editBuyerPhone',
      'editBuyerAddress',
      'editBuyerNameB2C',
      'editBuyerEmailB2C',
      'editBuyerPhoneB2C',
      'editBuyerAddressB2C',
      'editMerchantOrderNo',
      'editMerchantOrderNoB2C',
      'editTaxRate',
      'editComment',
      'editProcessingInput'
    ];

    textFields.forEach((fieldId) => {
      const element = document.getElementById(fieldId);
      if (element) {
        element.value = '';
      }
    });

    const selectFields = ['editTaxType', 'editInvoiceProcessing'];
    selectFields.forEach((fieldId) => {
      const element = document.getElementById(fieldId);
      if (element && element.tagName === 'MD-OUTLINED-SELECT') {
        element.getUpdateComplete().then(() => {
          element.value = '';
        });
      }
    });

    const customsCheckbox = document.getElementById('editCustomsClearance');
    if (customsCheckbox) {
      customsCheckbox.checked = false;
    }

    this.itemManager?.clearAllItems();
  };

  setDefaultCategory = (category = 'B2B') => {
    const categoryText = this.dom.categoryText;
    const categoryInput = this.dom.categoryInput;

    if (categoryText) {
      const isMobile = window.innerWidth < 640;
      categoryText.textContent = category;
    }
    if (categoryInput) categoryInput.value = category;

    const b2bBasicFields = this.dom.b2bBasicFields;
    const b2cBasicFields = this.dom.b2cBasicFields;
    const b2cOnlyFields = this.dom.b2cOnlyFields;

    if (category === 'B2B') {
      if (b2bBasicFields) b2bBasicFields.classList.remove('hidden');
      if (b2cBasicFields) b2cBasicFields.classList.add('hidden');
      if (b2cOnlyFields) b2cOnlyFields.classList.add('hidden');
    } else {
      if (b2bBasicFields) b2bBasicFields.classList.add('hidden');
      if (b2cBasicFields) b2cBasicFields.classList.remove('hidden');
      if (b2cOnlyFields) b2cOnlyFields.classList.remove('hidden');
    }

    const taxTypeSelect = document.getElementById('editTaxType');
    const taxRateField = document.getElementById('editTaxRate');

    if (taxTypeSelect) {
      taxTypeSelect.getUpdateComplete().then(() => {
        taxTypeSelect.value = '1';
        taxTypeSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }

    if (taxRateField) {
      taxRateField.value = '5';
      taxRateField.disabled = true;
    }

    const merchantOrderField =
      category === 'B2B'
        ? document.getElementById('editMerchantOrderNo')
        : document.getElementById('editMerchantOrderNoB2C');

    if (merchantOrderField) {
      merchantOrderField.value = this.generateMerchantOrderNo();
    }
  };

  transferDataToB2B = (invoiceData) => {
    const fields = [
      ['editBuyerName', 'buyer_name'],
      ['editBuyerUBN', 'buyer_ubn'],
      ['editBuyerEmail', 'buyer_email'],
      ['editBuyerPhone', 'buyer_phone'],
      ['editBuyerAddress', 'buyer_address'],
      ['editMerchantOrderNo', 'merchant_order_no']
    ];

    fields.forEach(([fieldId, dataKey]) => {
      const element = document.getElementById(fieldId);
      if (element && invoiceData[dataKey] !== undefined) {
        element.value = invoiceData[dataKey] || '';
      }
    });
  };

  fillFieldsFromOriginalData = (category) => {
    if (!this.originalInvoiceData) return;

    if (category === 'B2B') {
      this.transferDataToB2B(this.originalInvoiceData);
    } else {
      const fields = [
        ['editBuyerNameB2C', 'buyer_name'],
        ['editBuyerEmailB2C', 'buyer_email'],
        ['editBuyerPhoneB2C', 'buyer_phone'],
        ['editBuyerAddressB2C', 'buyer_address'],
        ['editMerchantOrderNoB2C', 'merchant_order_no']
      ];

      fields.forEach(([fieldId, dataKey]) => {
        const element = document.getElementById(fieldId);
        if (element && this.originalInvoiceData[dataKey] !== undefined) {
          element.value = this.originalInvoiceData[dataKey] || '';
        }
      });

      const invoiceProcessingSelect = document.getElementById(
        'editInvoiceProcessing'
      );
      const processingInput = this.dom.processingInput;

      if (invoiceProcessingSelect && processingInput) {
        let processingValue = 'print';
        let inputValue = '';

        if (this.originalInvoiceData.love_code) {
          processingValue = 'donate';
          inputValue = this.originalInvoiceData.love_code;
        } else if (this.originalInvoiceData.carrier_type) {
          processingValue = this.originalInvoiceData.carrier_type;
          inputValue = this.originalInvoiceData.carrier_num || '';
        }

        invoiceProcessingSelect.value = processingValue;
        invoiceProcessingSelect.dispatchEvent(new Event('change'));

        if (inputValue) {
          processingInput.value = inputValue;
        }
      }
    }
  };

  populateEditItems = (items, invoiceTaxType = '1') => {
    const itemsList = this.dom.itemsList;

    if (this.itemManager) {
      this.itemManager.populateItems(items || [], invoiceTaxType || '1');
    }
  };

  getFieldRules = (fieldId) => {
    const field = document.getElementById(fieldId);

    const rules = {};

    if (field.hasAttribute('data-required') || field.required) {
      rules.required = true;
    }

    if (field.pattern) {
      rules.pattern = new RegExp(field.pattern);
    }

    if (field.minLength > 0) {
      rules.minLength = field.minLength;
    }

    if (field.maxLength > 0) {
      rules.maxLength = field.maxLength;
    }

    const errorText = field.getAttribute('data-error-text');
    if (errorText) {
      rules.errorMessage = errorText;
    }

    return rules;
  };

  generateMerchantOrderNo = () => {
    return this.dataEngine.generateOrderNo();
  };

  convertApiTaxTypeToUI = (apiTaxType, customsClearance) => {
    switch (apiTaxType) {
      case '2':
        if (customsClearance === '1') {
          return '2_1';
        } else if (customsClearance === '2') {
          return '2_2';
        } else {
          return '2_1';
        }
      default:
        return apiTaxType;
    }
  };

  handleTaxTypeChange = (event) => {
    const taxType = event.target.value;
    const customsClearanceField = this.dom.customsClearanceField;
    const mixedTaxBreakdown = this.dom.mixedTaxBreakdown;
    const taxRateField = this.dom.taxRateField;

    if (customsClearanceField) {
      customsClearanceField.classList.add('hidden');
    }

    if (taxType === '2_1' || taxType === '2_2') {
      if (taxRateField) {
        taxRateField.value = '0';
        taxRateField.disabled = true;
      }
    } else if (taxType === '3') {
      if (taxRateField) {
        taxRateField.value = '0';
        taxRateField.disabled = true;
      }
    } else if (taxType === '1') {
      if (taxRateField) {
        taxRateField.value = '5';
        taxRateField.disabled = true;
      }
    } else if (taxType === '9') {
      if (taxRateField) {
        if (!taxRateField.value || taxRateField.value === '0') {
          taxRateField.value = '5';
        }
        taxRateField.disabled = parseFloat(taxRateField.value) === 5;
      }
    }

    if (taxType === '9') {
      if (mixedTaxBreakdown) mixedTaxBreakdown.classList.remove('hidden');
      this.itemManager.rerenderItemsForMixedTax();
    } else {
      if (mixedTaxBreakdown) mixedTaxBreakdown.classList.add('hidden');
      this.itemManager.rerenderItemsForSingleTax();
    }

    this.itemManager.updateCalculations();
  };

  getCarrierDescription = (platform, carrierType) => {
    if (
      this.platforms[platform] &&
      typeof this.platforms[platform].getCarrierDescription === 'function'
    ) {
      return this.platforms[platform].getCarrierDescription(carrierType);
    }
    return `載具類型 ${carrierType}`;
  };

  setController(controller) {
    this.controller = controller;
  }
}

export { FormHandler };
