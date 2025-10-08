/**
 * ItemManager Module
 * Invoice item management and operations
 */

import { Utils } from './utils.js';

class ItemManager {
  constructor(domElements, dialogManager, eventBus = null) {
    this.dom = domElements;
    this.dialogManager = dialogManager;
    this.eventBus = eventBus;

    this.calculatedAmounts = {
      amt: 0,
      sales_amount: 0,
      zero_tax_sales_amount: 0,
      free_tax_sales_amount: 0,
      tax_amt: 0,
      total_amt: 0
    };

  }

  populateItems = (items, invoiceTaxType = '1') => {
    const itemsList = this.dom.itemsList;
    if (!itemsList) {
      return;
    }

    itemsList.innerHTML = '';

    items.forEach((item, index) => {
      this.addItemRow(item, invoiceTaxType);
    });

    if (items.length === 0) {
      this.addItemRow({}, invoiceTaxType);
    }
  };

  addItemRow = (itemData = {}, invoiceTaxType = null) => {
    const itemsList = this.dom.itemsList;
    const itemIndex = itemsList.children.length;
    const taxType =
      invoiceTaxType || Utils.getActiveTaxElements().taxType?.value || '1';

    const itemRow = document.createElement('div');
    itemRow.className = 'space-y-3';

    let taxTypeSelect = '';
    const itemTaxType = itemData.tax_type || '1';
    if (taxType === '9') {
      taxTypeSelect = `
  <md-outlined-select label="稅型" data-field="taxType" data-tax-type="${itemTaxType}" data-required="true">
  <md-select-option value="1" ${itemTaxType === '1' ? 'selected' : ''}>應稅</md-select-option>
  <md-select-option value="2_1" ${itemTaxType === '2_1' ? 'selected' : ''}>零稅率(非複合經營)</md-select-option>
  <md-select-option value="2_2" ${itemTaxType === '2_2' ? 'selected' : ''}>零稅率(複合經營)</md-select-option>
  <md-select-option value="3" ${itemTaxType === '3' ? 'selected' : ''}>免稅</md-select-option>
  </md-outlined-select>
  `;
    }

    itemRow.innerHTML = `
  <div class="item-fields-grid grid gap-4" style="grid-template-columns: 1fr 80px 70px 100px ${taxType === '9' ? '140px' : ''} 56px;">
  <md-outlined-text-field
  label="Item ${itemIndex + 1} Name"
  value="${Utils.escapeHtml(itemData.name) || ''}"
  data-field="name"
  required
  supporting-text="請輸入項目名稱"
  error-text="請填寫項目名稱">
  </md-outlined-text-field>
  <md-outlined-text-field
  label="Qty"
  type="number"
  min="1"
  step="1"
  value="${Utils.escapeHtml(itemData.count) || 1}"
  data-field="count"
  required
  supporting-text="預設為1"
  error-text="請填數量">
  </md-outlined-text-field>
  <md-outlined-text-field
  label="Unit"
  value="${Utils.escapeHtml(itemData.unit) || ''}"
  data-field="unit">
  </md-outlined-text-field>
  <md-outlined-text-field
  label="Price"
  type="number"
  min="0"
  step="0.01"
  no-spinner
  value="${Utils.escapeHtml(itemData.price) || ''}"
  data-field="price"
  required
  supporting-text="請輸入單價"
  error-text="請填寫單價">
  </md-outlined-text-field>
  ${taxTypeSelect}
  <md-icon-button class="remove-item-btn text-red-400" style="transform: translateY(-10px);">
  <md-icon>delete</md-icon>
  </md-icon-button>
  </div>
`;

    const removeBtn = itemRow.querySelector('.remove-item-btn');
    removeBtn.addEventListener('click', (e) => {
      e.preventDefault();

      const allItems = document
        .getElementById('itemsList')
        .querySelectorAll(':scope > div');
      if (allItems.length <= 1) {
        const nameField = itemRow.querySelector('[data-field="name"]');
        const priceField = itemRow.querySelector('[data-field="price"]');
        const countField = itemRow.querySelector('[data-field="count"]');
        const unitField = itemRow.querySelector('[data-field="unit"]');

        if (nameField) nameField.value = '';
        if (priceField) priceField.value = '';
        if (countField) countField.value = '';
        if (unitField) unitField.value = '';

        this.updateCalculations();
        return;
      }

      itemRow.remove();
      this.updateCalculations();

      const remainingItems = document
        .getElementById('itemsList')
        .querySelectorAll(':scope > div');
      remainingItems.forEach((item, index) => {
        const itemNameField = item.querySelector('[data-field="name"]');
        if (itemNameField) {
          itemNameField.setAttribute('label', `Item ${index + 1} Name`);
        }
      });
    });

    const inputs = itemRow.querySelectorAll(
      'md-outlined-text-field, md-outlined-select'
    );
    inputs.forEach((input) => {
      input.addEventListener('input', (e) => {
        this.updateCalculations();
      });
      input.addEventListener('change', (e) => {
        if (
          input.hasAttribute('data-field') &&
          input.getAttribute('data-field') === 'taxType'
        ) {
          input.dataset.taxType = input.value;
        }
        this.updateCalculations();
      });
    });

    itemsList.appendChild(itemRow);
    this.updateCalculations();
  };

  updateCalculations = () => {
    const taxType = Utils.getActiveTaxElements().taxType?.value || '1';
    const taxRate = parseFloat(
      document.getElementById('editTaxRate')?.value || 5
    );

    let totalAmt = 0;
    let amtSales = 0;
    let amtZero = 0;
    let amtFree = 0;
    let taxAmt = 0;

    const itemRows = document
      .getElementById('itemsList')
      .querySelectorAll(':scope > div');
    itemRows.forEach((row, index) => {
      const name = row.querySelector('[data-field="name"]')?.value || '';
      const count =
        parseInt(row.querySelector('[data-field="count"]')?.value) || 0;
      const price =
        parseFloat(row.querySelector('[data-field="price"]')?.value) || 0;
      const taxTypeSelect = row.querySelector('[data-field="taxType"]');
      const itemTaxType =
        taxTypeSelect?.dataset?.taxType || taxTypeSelect?.value || '1';

      if (name || count >= 1 || price > 0) {
        const itemTotal = Math.round(count * price);
        totalAmt += itemTotal;

        if (taxType === '9') {
          switch (itemTaxType) {
            case '1':
              amtSales += itemTotal;
              taxAmt += Math.round((itemTotal * taxRate) / 100);
              break;
            case '2':
            case '2_1':
            case '2_2':
              amtZero += itemTotal;
              break;
            case '3':
              amtFree += itemTotal;
              break;
          }
        } else {
          switch (taxType) {
            case '1':
              amtSales = totalAmt;
              taxAmt = Math.round((totalAmt * taxRate) / 100);
              break;
            case '2':
            case '2_1':
            case '2_2':
              amtZero = totalAmt;
              taxAmt = 0;
              break;
            case '3':
              amtFree = totalAmt;
              taxAmt = 0;
              break;
          }
        }
      }
    });

    const total = totalAmt + taxAmt;

    this.calculatedAmounts = {
      amt: totalAmt,
      sales_amount: amtSales,
      zero_tax_sales_amount: amtZero,
      free_tax_sales_amount: amtFree,
      tax_amt: taxAmt,
      total_amt: total
    };

    const subtotalElement = document.getElementById('editSubtotal');
    if (subtotalElement) {
      subtotalElement.textContent = `NT$ ${Utils.formatTaiwanCurrency(totalAmt)}`;
    }
    const taxAmountElement = document.getElementById('editTaxAmount');
    if (taxAmountElement) {
      taxAmountElement.textContent = `NT$ ${Utils.formatTaiwanCurrency(taxAmt)}`;
    }
    const totalAmountElement = document.getElementById('editTotalAmount');
    if (totalAmountElement) {
      totalAmountElement.textContent = `NT$ ${Utils.formatTaiwanCurrency(total)}`;
    }
  };

  getEditFormItems = () => {
    const itemRows = document
      .getElementById('itemsList')
      .querySelectorAll(':scope > div');
    const items = [];

    itemRows.forEach((row, index) => {
      const name = row.querySelector('[data-field="name"]')?.value || '';
      const count =
        parseInt(row.querySelector('[data-field="count"]')?.value) || 0;
      const unit = row.querySelector('[data-field="unit"]')?.value || '';
      const price =
        parseFloat(row.querySelector('[data-field="price"]')?.value) || 0;
      const taxTypeSelect = row.querySelector('[data-field="taxType"]');
      const taxType =
        taxTypeSelect?.dataset?.taxType || taxTypeSelect?.value || '1';

      if (name || count >= 1 || price > 0) {
        items.push({
          name,
          count,
          unit,
          price,
          amt: Math.round(count * price),
          tax_type: taxType
        });
      }
    });

    return items;
  };

  rerenderItemsForMixedTax = () => {
    const itemRows = document
      .getElementById('itemsList')
      .querySelectorAll(':scope > div');
    const currentItems = [];
    itemRows.forEach((row, index) => {
      const name = row.querySelector('[data-field="name"]')?.value || '';
      const count =
        parseInt(row.querySelector('[data-field="count"]')?.value) || 1;
      const unit = row.querySelector('[data-field="unit"]')?.value || '';
      const price =
        parseFloat(row.querySelector('[data-field="price"]')?.value) || 0;
      const taxType = row.querySelector('[data-field="taxType"]')?.value || '1';

      if (name || count >= 1 || price > 0) {
        currentItems.push({ name, count, unit, price, tax_type: taxType });
      }
    });

    const itemsList = this.dom.itemsList;
    itemsList.innerHTML = '';

    if (currentItems.length > 0) {
      currentItems.forEach((item, index) => {
        this.addItemRow(item, '9');
      });
    } else {
      this.addItemRow({}, '9');
    }
  };

  rerenderItemsForSingleTax = () => {
    const itemRows = document
      .getElementById('itemsList')
      .querySelectorAll(':scope > div');
    const currentItems = [];
    itemRows.forEach((row, index) => {
      const name = row.querySelector('[data-field="name"]')?.value || '';
      const count =
        parseInt(row.querySelector('[data-field="count"]')?.value) || 1;
      const unit = row.querySelector('[data-field="unit"]')?.value || '';
      const price =
        parseFloat(row.querySelector('[data-field="price"]')?.value) || 0;

      if (name || count >= 1 || price > 0) {
        currentItems.push({ name, count, unit, price });
      }
    });

    const itemsList = this.dom.itemsList;
    itemsList.innerHTML = '';

    if (currentItems.length > 0) {
      currentItems.forEach((item, index) => {
        this.addItemRow(item, '1');
      });
    } else {
      this.addItemRow({}, '1');
    }
  };

  clearAllItems = () => {
    const itemsList = this.dom.itemsList;
    if (itemsList) {
      itemsList.innerHTML = '';
      this.updateCalculations();
    }
  };

  addDefaultItem = (taxType = '1') => {
    this.addItemRow({}, taxType);
  };

  getCalculatedAmounts = () => {
    return this.calculatedAmounts;
  };

  setCalculatedAmounts = (amounts) => {
    this.calculatedAmounts = { ...this.calculatedAmounts, ...amounts };
    this.updateUIDisplay();
  };

  updateUIDisplay = () => {
    const subtotalElement = document.getElementById('editSubtotal');
    if (subtotalElement) {
      subtotalElement.textContent = `NT$ ${Utils.formatTaiwanCurrency(
        this.calculatedAmounts.amt
      )}`;
    }
    const taxAmountElement = document.getElementById('editTaxAmount');
    if (taxAmountElement) {
      taxAmountElement.textContent = `NT$ ${Utils.formatTaiwanCurrency(
        this.calculatedAmounts.tax_amt
      )}`;
    }
    const totalAmountElement = document.getElementById('editTotalAmount');
    if (totalAmountElement) {
      totalAmountElement.textContent = `NT$ ${Utils.formatTaiwanCurrency(
        this.calculatedAmounts.total_amt
      )}`;
    }
  };
}

export { ItemManager };
