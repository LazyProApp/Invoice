/**
 * DialogManager Module
 * Modal dialog management and form handling
 */

import { Utils } from './utils.js';
import { EVENTS } from '../core/events.js';

function setRequired(field, required) {
  field.required = required;
  field.toggleAttribute('required', required);
}

function setPattern(field, pattern) {
  if (pattern) {
    field.pattern = pattern;
    field.setAttribute('pattern', pattern);
  } else {
    field.pattern = '';
    field.removeAttribute('pattern');
  }
}

function resetCarrierInput(field) {
  field.error = false;
  field.setCustomValidity('');

  field.required = false;
  field.toggleAttribute('required', false);

  field.pattern = '';
  field.removeAttribute('pattern');

  field.readOnly = false;
  field.toggleAttribute('readonly', false);

  field.disabled = false;
  field.toggleAttribute('disabled', false);
  field.removeAttribute('disabled');

  field.removeAttribute('maxlength');
  field.removeAttribute('error-text');

  field.value = '';
  field.supportingText = '';
}

export class DialogManager {
  constructor(
    eventBus,
    domElements = null,
    dataManager = null,
    formHandler = null,
    controller = null
  ) {
    this.eventBus = eventBus;
    this.dom = domElements;
    this.dataManager = dataManager;
    this.formHandler = formHandler;
    this.controller = controller;
    this.itemManager = null;
    this.originalInvoiceData = null;
    this.pendingInvoiceData = null;
    this.currentMode = null;
    this.messagesCache = null;
    this.loadMessages();
  }

  async loadMessages() {
    if (!this.messagesCache) {
      try {
        const response = await fetch('./js/ui/messages.json');
        this.messagesCache = await response.json();
      } catch (error) {
        this.messagesCache = { alerts: {}, confirmations: {} };
      }
    }
    return this.messagesCache;
  }

  replaceTemplate(template, data) {
    if (!data) return template;
    return template.replace(/{(\w+)}/g, (match, key) => {
      if (data[key] === undefined) return match;

      if (key === 'mode') {
        const modeTranslations = {
          test: '測試',
          production: '正式'
        };
        return modeTranslations[data[key]] || data[key];
      }

      return data[key];
    });
  }

  initializeDialogs = () => {
    const editDialog = this.dom.editDialog;

    if (editDialog) {
      editDialog.addEventListener('click', this.handleEditDialogClick);
      this.setupEditDialog();
    }

    if (editDialog) {
      editDialog.addEventListener('close', this.removeDialogBlurEffect);
      editDialog.addEventListener('closed', this.removeDialogBlurEffect);
    }

    document.addEventListener('click', this.handleTableEditClick);

    this.eventBus.on(EVENTS.DOMAIN.INVOICE_ADDED, () => {
      this.closeEditDialog();
    });

    this.eventBus.on(EVENTS.DOMAIN.INVOICE_UPDATED, () => {
      this.closeEditDialog();
    });

    this.eventBus.on(EVENTS.DIALOG.CARRIER_CONFIG_SYNC, (data) => {
      this.handleCarrierConfigSync(data);
    });

    this.eventBus.on(EVENTS.DOMAIN.ALERT_REQUESTED, async (event) => {
      const messages = await this.loadMessages();
      const { type, data } = event;

      const messageConfig = messages.alerts[type];
      if (!messageConfig) {
        return;
      }

      const message = this.replaceTemplate(messageConfig.message, data);

      this.showAlertDialog(
        messageConfig.title,
        message,
        messageConfig.confirmText,
        messageConfig.icon || 'info'
      );
    });

    this.eventBus.on(EVENTS.DOMAIN.CONFIRMATION_REQUESTED, async (event) => {
      const messages = await this.loadMessages();
      const { type, data, onConfirm, onCancel } = event;

      const messageConfig = messages.confirmations[type];
      if (!messageConfig) {
        return;
      }

      const message = this.replaceTemplate(messageConfig.message, data);

      const result = await this.showConfirmDialog(
        messageConfig.title || '',
        message,
        messageConfig.confirmText,
        messageConfig.cancelText,
        messageConfig.icon || 'info'
      );

      if (result && onConfirm) {
        onConfirm();
      } else if (!result && onCancel) {
        onCancel();
      }
    });
  };

  setupEditDialog = () => {
    const categoryMenuButton = this.dom.categoryMenuButton;
    const categoryMenu = this.dom.categoryMenu;
    const { taxType: taxTypeSelect } = Utils.getActiveTaxElements();
    const carrierTypeSelect = this.dom.carrierTypeSelect;
    const invoiceProcessingSelect = this.dom.invoiceProcessingSelect;

    document.addEventListener('input', (e) => {
      if (e.target.closest('#editDialog')) {
        this.itemManager.updateCalculations();

        if (
          e.target.error &&
          e.target.checkValidity &&
          e.target.checkValidity()
        ) {
          e.target.error = false;
        }
      }
    });

    if (categoryMenuButton && categoryMenu) {
      categoryMenuButton.addEventListener('click', (e) => {
        e.preventDefault();
        categoryMenu.show();
      });

      categoryMenu.addEventListener('click', (event) => {
        const menuItem = event.target.closest('md-menu-item');
        if (menuItem) {
          const selectedValue = menuItem.getAttribute('value');
          if (selectedValue) {
            this.formHandler?.handleCategoryChange(selectedValue);
            categoryMenu.close();
          }
        }
      });
    }

    if (invoiceProcessingSelect) {
      invoiceProcessingSelect.addEventListener(
        'change',
        this.handleInvoiceProcessingChange
      );
    }

    if (carrierTypeSelect) {
      carrierTypeSelect.addEventListener(
        'change',
        this.formHandler?.handleCarrierTypeChange
      );
    }

    const addItemBtn = this.dom.addItemBtn;
    if (addItemBtn) {
      addItemBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.itemManager.addItemRow();
      });
    }
  };

  handleEditDialogClick = (event) => {
    const action = event.target.getAttribute('value');

    if (action === 'cancel') {
      this.dom.editDialog.close();
      this.removeDialogBlurEffect();
    } else if (action === 'save') {
      this.handleSaveClick();
    }
  };

  async handleSaveClick() {
    if (!(await this.validateFields())) return;

    const formData = await this.formHandler.getFormData();
    const isEdit = Boolean(this.originalInvoiceData);
    const orderNo = isEdit
      ? this.originalInvoiceData.merchant_order_no
      : formData.merchant_order_no;

    this.eventBus.emit(EVENTS.COMMAND.SAVE_INVOICE, {
      mode: isEdit ? 'edit' : 'create',
      orderNo,
      formData,
      timestamp: new Date().toISOString()
    });
  }

  handleTableEditClick = (event) => {
    const target = event.target;
    const row = target.closest('tr');
    const orderNo = row?.dataset.orderNo;

    if (
      target.closest('[data-action="edit"]') ||
      target.textContent === 'Detail'
    ) {
      if (orderNo) {
        this.openEditDialog(orderNo);
      }
    }
  };

  validateFields = async () => {
    const allFields = Array.from(
      document.querySelectorAll(
        '#editDialog md-outlined-text-field, #editDialog md-filled-text-field'
      )
    );
    await Promise.all(allFields.map((field) => field.updateComplete));

    let allValid = true;

    for (const field of allFields) {
      const isHidden =
        field.closest('.hidden') || field.closest('[class*="hidden"]');
      if (isHidden) {
        field.error = false;
        continue;
      }

      if (!field.required) continue;

      const needsValue = !field.disabled && !field.readOnly;
      const value = (field.value ?? '').trim();
      const errorMsg = field.getAttribute('error-text') || '此欄位為必填';

      if (needsValue && value === '') {
        field.setCustomValidity(errorMsg);
        field.error = true;
        allValid = false;
        continue;
      }

      field.setCustomValidity('');
      if (!field.checkValidity()) {
        field.error = true;
        allValid = false;
        continue;
      }

      field.error = false;
    }

    return allValid;
  };

  openEditDialog = async (orderNo = null, invoiceData = null) => {
    const editDialog = this.dom.editDialog;

    if (orderNo) {
      if (!invoiceData && this.dataManager && this.dataManager.getInvoice) {
        invoiceData = this.dataManager.getInvoice(orderNo);
      }

      if (invoiceData) {
        this.originalInvoiceData = invoiceData;

        if (this.formHandler && this.formHandler.setOriginalInvoiceData) {
          this.formHandler.setOriginalInvoiceData(invoiceData);
        }

        const platformId = this.controller?.getCurrentPlatform?.();
        const category = invoiceData.category || 'B2C';

        if (platformId) {
          this.updateCarrierOptionsForPlatform(
            platformId.toLowerCase(),
            category
          );
        }

        this.pendingInvoiceData = invoiceData;
      }
    } else {
      this.originalInvoiceData = null;

      if (this.formHandler && this.formHandler.setOriginalInvoiceData) {
        this.formHandler.setOriginalInvoiceData(null);
      }

      this.formHandler?.clearForm();

      this.resetCarrierFieldsCompletely();

      const currentPlatform = this.controller?.getCurrentPlatform?.();

      if (currentPlatform) {
        this.formHandler?.setDefaultCategory('B2B');
        this.updateCarrierOptionsForPlatform(currentPlatform, 'B2B');
      } else {
        this.formHandler?.setDefaultCategory('B2B');
      }

      this.itemManager.addDefaultItem('1');
    }

    this.formHandler?.setupCategoryToggleEvent();

    const { taxType: taxTypeSelect } = Utils.getActiveTaxElements();
    if (taxTypeSelect) {
      if (!taxTypeSelect.hasAttribute('data-listener-attached')) {
        taxTypeSelect.addEventListener(
          'change',
          this.formHandler?.handleTaxTypeChange
        );
        taxTypeSelect.setAttribute('data-listener-attached', 'true');
      }
    }

    setTimeout(() => {
      const fields = document.querySelectorAll(
        '#editDialog md-outlined-text-field, #editDialog md-outlined-select'
      );
      fields.forEach((field) => {
        field.error = false;
      });
    }, 100);

    this.applyDialogBlurEffect();
    editDialog.show();
  };

  applyDialogBlurEffect = () => {
    const inputContainer = document.querySelector('.input-container');
    if (inputContainer) {
      inputContainer.classList.add('dialog-blur');
    }

    const statsSection = document.getElementById('statsSection');
    if (statsSection && !statsSection.classList.contains('hidden')) {
      statsSection.classList.add('dialog-blur');
    }

    const previewSection = document.getElementById('previewSection');
    if (previewSection) {
      previewSection.classList.add('dialog-blur');
    }

    document.body.classList.add('dialog-open');
  };

  removeDialogBlurEffect = () => {
    const inputContainer = document.querySelector('.input-container');
    if (inputContainer) {
      inputContainer.classList.remove('dialog-blur');
    }

    const statsSection = document.getElementById('statsSection');
    if (statsSection) {
      statsSection.classList.remove('dialog-blur');
    }

    const previewSection = document.getElementById('previewSection');
    if (previewSection) {
      previewSection.classList.remove('dialog-blur');
    }

    document.body.classList.remove('dialog-open');

    this.originalInvoiceData = null;
  };

  resetCarrierFieldsCompletely = () => {
    const processingSelect = document.getElementById('editInvoiceProcessing');
    const processingInput = document.getElementById('editProcessingInput');

    if (processingSelect && processingInput) {
      this.syncSelectState(processingSelect, processingInput);

      processingSelect.innerHTML = '';

      processingInput.removeAttribute('data-required');
      processingInput.removeAttribute('data-error-text');
      processingInput.removeAttribute('data-base-supporting-text');
      processingInput.removeAttribute('data-validation-listener');
    }
  };

  handleInvoiceProcessingChange = (event) => {
    const processingValue = event.target.value;
    const processingInput = this.dom.processingInput;

    resetCarrierInput(processingInput);

    const platform = this.controller?.getPlatformInstance();
    const rules = platform?.carrierProvider?.getValidationRules?.() || {};
    const rule = rules[processingValue];

    if (!rule) {
      processingInput.disabled = true;
      return;
    }

    if (rule.readOnly) {
      processingInput.readOnly = true;
      processingInput.value = rule.text || '';
      processingInput.supportingText = rule.supportingText || '';
    } else {
      processingInput.disabled = false;

      if (rule.required) {
        setRequired(processingInput, true);
      }

      if (rule.pattern) {
        setPattern(processingInput, rule.pattern);
        processingInput.setAttribute(
          'error-text',
          rule.errorText || '格式錯誤'
        );
      }

      if (rule.maxlength) {
        processingInput.setAttribute('maxlength', rule.maxlength.toString());
      }

      if (rule.supportingText) {
        processingInput.supportingText = rule.supportingText;
      }
    }
  };

  showConfirmDialog = (
    title,
    message,
    confirmText = '確認',
    cancelText = '取消',
    icon = 'delete'
  ) => {
    return new Promise((resolve) => {
      const confirmDialog = document.createElement('md-dialog');
      confirmDialog.setAttribute('type', 'alert');
      confirmDialog.className = 'confirm-dialog';

      // prettier-ignore
      confirmDialog.innerHTML = `
  <div slot="content" class="confirm-content">
  <md-icon class="confirm-icon">${icon}</md-icon>
  <h2 class="confirm-title"></h2>
  <p class="confirm-message"></p>
  </div>
  <div slot="actions">
  <md-text-button class="cancel-btn"></md-text-button>
  <md-text-button class="confirm-btn"></md-text-button>
  </div>
  `;

      document.body.appendChild(confirmDialog);

      confirmDialog.querySelector('.confirm-title').textContent = title;
      confirmDialog.querySelector('.confirm-message').textContent = message;
      confirmDialog.querySelector('.cancel-btn').textContent = cancelText;
      confirmDialog.querySelector('.confirm-btn').textContent = confirmText;

      const confirmBtn = confirmDialog.querySelector('.confirm-btn');
      const cancelBtn = confirmDialog.querySelector('.cancel-btn');

      confirmBtn.addEventListener('click', async () => {
        await confirmDialog.close('confirm');
      });

      cancelBtn.addEventListener('click', async () => {
        await confirmDialog.close('cancel');
      });

      confirmDialog.addEventListener('closed', () => {
        this.removeDialogBlurEffect();

        if (confirmDialog.parentNode) {
          confirmDialog.parentNode.removeChild(confirmDialog);
        }

        const result = confirmDialog.returnValue === 'confirm';
        resolve(result);
      });

      this.applyDialogBlurEffect();

      confirmDialog.show();
    });
  };

  showAlertDialog = (
    title,
    message,
    confirmText = '確定',
    icon = 'warning'
  ) => {
    return new Promise((resolve) => {
      const alertDialog = document.createElement('md-dialog');
      alertDialog.setAttribute('type', 'alert');
      alertDialog.className = 'confirm-dialog';

      // prettier-ignore
      alertDialog.innerHTML = `
  <div slot="content" class="confirm-content">
  <md-icon class="confirm-icon">${icon}</md-icon>
  <h2 class="confirm-title"></h2>
  <p class="confirm-message"></p>
  </div>
  <div slot="actions">
  <md-text-button class="confirm-btn"></md-text-button>
  </div>
  `;

      document.body.appendChild(alertDialog);

      alertDialog.querySelector('.confirm-title').textContent = title;
      alertDialog.querySelector('.confirm-message').textContent = message;
      alertDialog.querySelector('.confirm-btn').textContent = confirmText;

      const confirmBtn = alertDialog.querySelector('.confirm-btn');

      confirmBtn.addEventListener('click', async () => {
        await alertDialog.close('confirm');
      });

      alertDialog.addEventListener('closed', () => {
        this.removeDialogBlurEffect();

        if (alertDialog.parentNode) {
          alertDialog.parentNode.removeChild(alertDialog);
        }

        const result = alertDialog.returnValue === 'confirm';
        resolve(result);
      });

      this.applyDialogBlurEffect();

      alertDialog.show();
    });
  };

  syncSelectState = (selectElement, inputElement) => {
    selectElement.value = '';
    inputElement.value = '';
    inputElement.disabled = true;
    inputElement.required = false;
    inputElement.pattern = '';
    inputElement.maxLength = -1;
    inputElement.minLength = -1;
    inputElement.placeholder = 'Select carrier type first';
    inputElement.supportingText = 'Choose a carrier type from the dropdown above';
    inputElement.errorText = '';
    inputElement.error = false;
  };

  updateCarrierOptionsForPlatform = async (platform, category = null) => {
    const processingSelect = document.getElementById('editInvoiceProcessing');
    const processingInput = document.getElementById('editProcessingInput');

    if (!processingSelect || !processingInput) {
      return;
    }

    if (!processingSelect.parentElement) {
      return;
    }

    const currentCategory = category || this.getCurrentCategory();

    this.eventBus.emit(EVENTS.DIALOG.CARRIER_CONFIG_REQUESTED, {
      platform,
      category: currentCategory
    });
  };

  async applyCarrierConfig(platformConfig, platform, category) {
    const processingSelect = document.getElementById('editInvoiceProcessing');
    const processingInput = document.getElementById('editProcessingInput');

    if (!processingSelect || !processingInput) {
      return;
    }

    let options = [];
    if (!platformConfig) {
      return;
    }

    if (Array.isArray(platformConfig)) {
      options = platformConfig;
    } else {
      const key =
        (category || 'B2C').toUpperCase() === 'B2B'
          ? 'b2b_options'
          : 'b2c_options';
      options = platformConfig[key] || [];
    }

    if (!Array.isArray(options) || options.length === 0) {
      return;
    }

    const validOptions = options.filter(
      (option) => option && typeof option === 'object' && option.label
    );
    if (validOptions.length !== options.length) {
      options = validOptions;
    }

    const updateSuccess = await this.updateWebComponentContent(
      processingSelect,
      options
    );

    if (!updateSuccess) {
      this.forceWebComponentRefresh(processingSelect);
    }

    this.syncSelectState(processingSelect, processingInput);

    if (this.pendingInvoiceData && this.formHandler) {
      this.formHandler.populateEditDialog(this.pendingInvoiceData);
      this.pendingInvoiceData = null;
    }
  }

  getCurrentCategory = () => {
    const categoryInput = document.getElementById('editCategory');
    if (categoryInput && categoryInput.value) {
      return categoryInput.value;
    }

    const categoryText = document.getElementById('categoryText');
    if (categoryText) {
      const text = categoryText.textContent.trim();
      return text.includes('B2B') ? 'B2B' : 'B2C';
    }
    return 'B2C';
  };

  handlePromptRequest({ context, payload }) {
    if (context === 'alert') {
      this.showAlertDialog(
        payload.title,
        payload.message,
        payload.confirmText || '確定',
        payload.icon || 'info'
      );
    }
  }

  async handlePlatformChanged(newPlatform) {
    const editDialog = document.getElementById('editInvoiceDialog');
    const processingSelect = document.getElementById('editInvoiceProcessing');

    if (editDialog && editDialog.open && processingSelect) {
      const categoryRadios = document.querySelectorAll(
        'input[name="invoice_category"]'
      );
      let currentCategory = 'B2B';

      for (const radio of categoryRadios) {
        if (radio.checked) {
          currentCategory = radio.value;
          break;
        }
      }

      this.updateCarrierOptionsForPlatform(newPlatform, currentCategory);
    }
  }

  async updateWebComponentContent(element, options) {
    if (!element) {
      return false;
    }

    try {
      element.innerHTML = '';

      options.forEach((option) => {
        const optionElement = document.createElement('md-select-option');
        optionElement.setAttribute('value', option.value);
        optionElement.textContent = option.label;

        if (option.disabled) {
          optionElement.setAttribute('disabled', 'true');
        }

        element.appendChild(optionElement);
      });

      const updatePromises = [];

      if (typeof element.requestUpdate === 'function') {
        element.requestUpdate();
      }

      if (typeof element.updateComplete !== 'undefined') {
        updatePromises.push(element.updateComplete);
      }

      if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
      }

      await new Promise((resolve) => requestAnimationFrame(resolve));

      return true;
    } catch (error) {
      return false;
    }
  }

  forceWebComponentRefresh(element) {
    if (!element) return;

    const parent = element.parentElement;
    const nextSibling = element.nextSibling;

    parent.removeChild(element);

    requestAnimationFrame(() => {
      if (nextSibling) {
        parent.insertBefore(element, nextSibling);
      } else {
        parent.appendChild(element);
      }
    });
  }

  handleDialogRequest({ context, payload }) {
    if (context === 'invoice:create') {
      this.currentMode = 'create';
      this.openEditDialog(null);
      if (payload && this.formHandler) {
        setTimeout(() => {
          this.formHandler.populateEditDialog(payload);
        }, 100);
      }
    } else if (context === 'invoice:edit') {
      this.currentMode = 'edit';
      this.openEditDialog(payload.orderNo, payload.data);
    } else if (context === 'invoice:delete') {
      this.handlePromptRequest({
        context: 'void',
        payload: {
          orderNo: payload.orderNo,
          message: payload.message
        }
      });
    }
  }

  handleDialogResult({ dialog, success, orderNo, mode }) {
    if (dialog === 'invoice' && success) {
      this.dom.editDialog?.close();
      this.removeDialogBlurEffect();
      this.originalInvoiceData = null;
      this.currentMode = null;
    }
  }

  show(dialogType, context) {
    if (dialogType === 'invoice:create') {
      this.openEditDialog(null);
    } else if (dialogType === 'invoice:edit') {
      this.openEditDialog(context.orderNo, context.data);
    }
  }

  async askConfirm(confirmType, payload) {
    if (confirmType === 'clear-data') {
      return await this.showConfirmDialog(
        '清空所有資料',
        payload.message || '確定要清空嗎？',
        '確定',
        '取消'
      );
    } else if (confirmType === 'void_invoice') {
      return await this.showConfirmDialog(
        '作廢發票',
        payload.message,
        '作廢',
        '取消'
      );
    } else if (confirmType === 'delete') {
      return await this.showConfirmDialog(
        '刪除發票',
        payload.message || '確定要刪除此發票嗎？',
        '刪除',
        '取消'
      );
    }
    return false;
  }

  closeEditDialog() {
    if (this.dom.editDialog) {
      this.dom.editDialog.close();
    }
  }

  handleCarrierConfigSync(data) {
    const { platform, category, config, error } = data;

    if (error) {
      return;
    }

    if (config) {
      this.applyCarrierConfig(config, platform, category);
    }
  }

  updateCarrierConfig(config) {
    if (config && this.carrierFieldManager) {
      this.carrierFieldManager.updateOptions(config);
    }
  }
}
