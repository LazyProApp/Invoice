/**
 * TableManager Module
 * Invoice table rendering and management
 */

import { Utils } from './utils.js';
import { EVENTS } from '../core/events.js';

class TableManager {
  constructor(eventBus, domElements = null, dataEngine = null) {
    this.eventBus = eventBus;
    this.dom = domElements || {};
    this.dataEngine = dataEngine;
    this.statisticsManager = null;
    this.currentFilter = 'all';
    this.currentProvider = null;
    this.eventListenersSetup = false;
    this.tableEventListener = null;
    this.initializeTableEvents();
    this.setupEventListeners();
  }

  initializeTableEvents = () => {
    if (this.tableEventListener) {
      return this.tableEventListener;
    }

    const tableContainer = document.querySelector(
      '.table-container, #invoiceTable, [data-table-container]'
    );
    let targetElement = tableContainer;

    if (!tableContainer) {
      targetElement = document;
    }

    targetElement.addEventListener('click', this.handleTableActionClick);

    this.tableEventListener = () => {
      targetElement.removeEventListener('click', this.handleTableActionClick);
      this.tableEventListener = null;
    };

    return this.tableEventListener;
  };


  setupEventListeners() {
    if (!this.eventBus) return;

    if (this.eventListenersSetup) {
      return;
    }


    this.eventListenersSetup = true;
  }

  handleTableActionClick = (event) => {
    const target = event.target;
    const actionElement = target.closest('[data-action]');

    if (!actionElement) return;

    const row = actionElement.closest('tr');
    if (!row) return;

    const orderNo = row.dataset.orderNo;
    if (!orderNo) return;

    const action = actionElement.dataset.action;


    this.eventBus.emit(EVENTS.UI.TABLE_ACTION_CLICKED, {
      action,
      orderNo,
      timestamp: new Date().toISOString()
    });
  };

  populateInvoiceTable = (validInvoices, invalidInvoices) => {
    const tableBody = this.dom.invoiceTableBody;
    if (!tableBody) return;

    const totalInvoices = validInvoices.length + invalidInvoices.length;

    tableBody.innerHTML = '';

    const errorMap = new Map();
    invalidInvoices.forEach((errorInvoice) => {
      errorMap.set(errorInvoice.index, errorInvoice);
    });

    const allInvoices = [];

    validInvoices.forEach((invoice) => {
      allInvoices[invoice._index - 1] = {
        invoice: invoice,
        status: 'pending',
        index: invoice._index
      };
    });

    invalidInvoices.forEach((errorInvoice) => {
      allInvoices[errorInvoice.index - 1] = {
        invoice: errorInvoice.invoice,
        status: 'failed',
        index: errorInvoice.index,
        error: errorInvoice.error
      };
    });

    allInvoices.forEach((item) => {
      if (item) {
        const row = this.createInvoiceRow(
          item.invoice,
          item.status,
          item.invoice.merchant_order_no,
          item.error
        );
        tableBody.appendChild(row);
      }
    });

    document.dispatchEvent(
      new CustomEvent('table-updated', {
        detail: { totalInvoices }
      })
    );
  };

  createInvoiceRow = (
    invoice,
    status = 'pending',
    orderNo = null,
    error = null
  ) => {
    const row = document.createElement('tr');
    row.className = 'group';
    row.setAttribute('data-status', status);

    const finalOrderNo = orderNo || invoice.merchant_order_no;

    if (!finalOrderNo) {
      return null;
    }

    row.setAttribute('data-order-no', finalOrderNo);

    let statusIcon = 'schedule';
    let statusColor = 'text-zinc-400';
    let isProcessing = false;
    
    if (status === 'processing') {
      isProcessing = true;
    } else if (status === 'success') {
      statusIcon = 'check_circle';
      statusColor = 'text-green-300';
    } else if (status === 'failed') {
      statusIcon = 'error';
      statusColor = 'text-red-300';
    } else if (status === 'copy') {
      statusIcon = 'content_copy';
      statusColor = 'text-zinc-400';
    } else if (status === 'voided') {
      statusIcon = 'cancel';
      statusColor = 'text-orange-400';
    }

    let categoryText = Utils.escapeHtml(invoice.category) || 'Unknown';

    if (invoice.invoiceNumber) {
      categoryText = `${categoryText} #${Utils.escapeHtml(invoice.invoiceNumber)}`;
    }
    const carrierInfo = Utils.escapeHtml(this.getCarrierInfo(invoice));

    let totalAmount = invoice.total_amt || 0;

    if (!totalAmount && invoice.items && Array.isArray(invoice.items)) {
      totalAmount = invoice.items.reduce((sum, item) => {
        return sum + item.count * item.price;
      }, 0);

      if (invoice.tax_type === '1' && invoice.tax_rate) {
        totalAmount += Math.round((totalAmount * invoice.tax_rate) / 100);
      }
    }

    let statusLineHtml = '<div class="text-red-400 text-xs mt-1 error-message hidden" style="font-size: 11px;"></div>';
    
    if (status === 'failed' && error) {
      statusLineHtml = `<div class="text-red-400 text-xs mt-1 error-message" style="font-size: 11px;">${Utils.escapeHtml(error)}</div>`;
    } else if (status === 'voided') {
      statusLineHtml = `<div class="text-orange-400 text-xs mt-1 status-message" style="font-size: 11px;">發票已作廢</div>`;
    }

    let thirdButtonHtml = '';
    if (status !== 'voided') {
      const actionType = (status === 'success') ? 'void' : 'delete';
      const actionIcon = (status === 'success') ? 'block' : 'delete';
      const actionText = (status === 'success') ? 'Void' : 'Delete';
      
      thirdButtonHtml = `
        <div class="flex items-center space-x-1 cursor-pointer transition-colors hover-white" style="font-size: 12px; color: rgb(144, 144, 144);" data-action="${actionType}">
          <span class="material-symbols-outlined" style="font-size: 14px;">${actionIcon}</span>
          <span>${actionText}</span>
        </div>`;
    }

    const actionButtonsHtml = `
      <div class="absolute top-0 left-0 opacity-0 fade-actions flex space-x-3">
        <div class="flex items-center space-x-1 cursor-pointer transition-colors hover-white" style="font-size: 12px; color: rgb(144, 144, 144);" data-action="edit">
          <span class="material-symbols-outlined" style="font-size: 14px;">info</span>
          <span>Detail</span>
        </div>
        <div class="flex items-center space-x-1 cursor-pointer transition-colors hover-white" style="font-size: 12px; color: rgb(144, 144, 144);" data-action="duplicate">
          <span class="material-symbols-outlined" style="font-size: 14px;">content_copy</span>
          <span>Duplicate</span>
        </div>
        ${thirdButtonHtml}
      </div>`;

    const statusCellContent = isProcessing
      ? `<md-circular-progress indeterminate style="
           --md-circular-progress-size: 24px;
           --md-circular-progress-active-indicator-width: 15;
           --md-circular-progress-color: var(--md-sys-color-primary);
         "></md-circular-progress>`
      : `<span class="material-symbols-outlined ${statusColor} text-xl">
         ${statusIcon}
         </span>`;

    row.innerHTML = `
  <td class="py-4 px-6 text-center" data-label="Status">
  ${statusCellContent}
  </td>
  <td class="py-4 px-6 text-gray-100 table-cell" data-label="Type">
  <div class="category-text">${categoryText}</div>
  <div class="relative carrier-action-container">
  <span class="fade-text carrier-info">${carrierInfo}</span>
  ${actionButtonsHtml}
  </div>
  ${statusLineHtml}
  </td>
  <td class="py-4 px-6 text-gray-100 table-cell" data-label="Buyer">
  <div>${Utils.escapeHtml(invoice.buyer_name) || '-'}</div>
  ${invoice.buyer_ubn ? `<div class="text-zinc-300 text-sm">${Utils.escapeHtml(invoice.buyer_ubn)}</div>` : ''}
  </td>
  <td class="py-4 px-6 text-gray-100 table-cell" data-label="Amount">NT$ <span class="sf-numbers">${Utils.formatTaiwanCurrency(totalAmount)}</span></td>
`;

    if (status === 'failed' && error) {
      row.title = `Error: ${error}`;
    }

    return row;
  };


  getCarrierInfo = (invoice) => {
    try {
      if (invoice.carrier_text) {
        return invoice.carrier_text;
      }

      if (invoice.provider && this.eventBus) {
        if (invoice.carrier_type) {
          this.eventBus.emit(EVENTS.UI.CARRIER_DESCRIPTION_REQUESTED, {
            platform: invoice.provider,
            carrierCode: invoice.carrier_type,
            orderNo: invoice.merchant_order_no
          });
        }
        if (invoice.love_code) {
          this.eventBus.emit(EVENTS.UI.CARRIER_DESCRIPTION_REQUESTED, {
            platform: invoice.provider,
            carrierCode: 'donate',
            orderNo: invoice.merchant_order_no
          });
        }
        if (!invoice.carrier_type && !invoice.love_code) {
          this.eventBus.emit(EVENTS.UI.CARRIER_DESCRIPTION_REQUESTED, {
            platform: invoice.provider,
            carrierCode: 'print',
            orderNo: invoice.merchant_order_no
          });
        }
      }

      return '';
    } catch (error) {
      return '';
    }
  };

  updateCarrierDescription(orderNo, description) {
    const tableBody =
      this.dom.invoiceTableBody || document.getElementById('invoiceTableBody');
    if (!tableBody || !description) {
      return;
    }

    const row = tableBody.querySelector(`[data-order-no="${orderNo}"]`);
    if (row) {
      const carrierElement = row.querySelector('.carrier-info');
      if (carrierElement) {
        carrierElement.textContent = description;
      }
    }
  }

  updateTableRowDisplay = (orderNo, invoiceData) => {
    if (!orderNo || !invoiceData) {
      return;
    }

    const tableBody =
      this.dom.invoiceTableBody || document.getElementById('invoiceTableBody');
    if (!tableBody) {
      return;
    }

    const row = tableBody.querySelector(`tr[data-order-no="${orderNo}"]`);
    if (!row) {
      return;
    }

    const currentStatus = invoiceData._status || 'pending';
    const currentError = Object.prototype.hasOwnProperty.call(invoiceData, '_error')
      ? invoiceData._error
      : null;

    const newRow = this.createInvoiceRow(
      invoiceData,
      currentStatus,
      orderNo,
      currentError
    );

    if (newRow) {
      row.replaceWith(newRow);
    }
  };


  addInvoiceRow = (
    invoiceData,
    addToTop = false,
    status = null,
    orderNo = null,
    insertAfter = null
  ) => {
    const tableBody =
      this.dom.invoiceTableBody || document.getElementById('invoiceTableBody');
    if (!tableBody) {
      return;
    }


    if (!invoiceData) {
      return;
    }

    const finalOrderNo = orderNo || invoiceData.merchant_order_no;
    if (!finalOrderNo) {
      return;
    }

    const finalStatus = status || invoiceData._status || 'pending';

    const row = this.createInvoiceRow(
      invoiceData,
      finalStatus,
      finalOrderNo
    );

    if (!row) {
      return;
    }


    this.showTable();

    row.classList.add('row-fade-in');

    if (insertAfter) {
      const originalRow = tableBody.querySelector(`[data-order-no="${insertAfter}"]`);
      if (originalRow) {
        if (originalRow.nextSibling) {
          tableBody.insertBefore(row, originalRow.nextSibling);
        } else {
          tableBody.appendChild(row);
        }
      } else {
        tableBody.appendChild(row);
      }
    } else if (addToTop) {
      if (tableBody.firstChild) {
        tableBody.insertBefore(row, tableBody.firstChild);
      } else {
        tableBody.appendChild(row);
      }
    } else {
      tableBody.appendChild(row);
    }

    setTimeout(() => {
      row.classList.remove('row-fade-in');
    }, 300);

  };

  handleFilterChange(status) {
    this.currentFilter = status;
    this.applyTableFilter(status);
  }




  removeInvoiceFromTable(data) {
    const orderId = data.id || data.orderNo;
    const row = document.querySelector(`tr[data-order-no="${orderId}"]`);

    if (row) {
      row.remove();
      this.applyTableFilter(this.currentFilter || 'all');

      if (this.statisticsManager) {
        this.statisticsManager.updateStatistics();
      }

      const tableBody = this.dom.invoiceTableBody;
      if (tableBody && tableBody.children.length === 0) {
        this.clearTable();
      }
    }
  }

  refreshTable(data) {

    if (data && data.results && data.results.successful) {
      const formattedInvoices = data.results.successful.map(
        (invoice, index) => ({
          ...invoice,
          _index: index + 1
        })
      );
      this.populateInvoiceTable(formattedInvoices, data.results.failed || []);
    } else {
      this.clearTable();
    }
  }

  clearTable() {
    const tableBody = document.getElementById('invoiceTableBody');
    if (tableBody) {
      tableBody.innerHTML = '';
    }

    const emptyState = document.getElementById('emptyState');
    const invoiceTable = document.getElementById('invoiceTable');

    if (emptyState && invoiceTable) {
      emptyState.style.display = 'block';
      invoiceTable.style.display = 'none';
    }
  }

  showTable() {
    const emptyState = document.getElementById('emptyState');
    const invoiceTable = document.getElementById('invoiceTable');

    if (emptyState && invoiceTable) {
      emptyState.style.display = 'none';
      invoiceTable.style.display = 'block';
    }
  }


  handleTableFilter(filterData) {
    const { filterStatus, invoices } = filterData;
    this.currentFilter = filterStatus;

    this.clearTable();

    if (invoices && invoices.length > 0) {
      const formattedInvoices = invoices.map((invoice, index) => ({
        ...invoice,
        _index: index + 1
      }));
      this.populateInvoiceTable(formattedInvoices, []);
      this.showTable();
    }
  }


  insertRows(newRows, options = {}) {
    const rows = Array.isArray(newRows) ? newRows : [newRows];
    const { addToTop = false, insertAfter = null } = options;

    rows.forEach(({ orderNo, data, status = 'pending', position, insertAfter: rowInsertAfter, originalOrderNo }) => {
      const actualAddToTop = addToTop || position === 'top';
      const actualInsertAfter = insertAfter || rowInsertAfter ||
        (position?.startsWith('after:') ? position.split(':')[1] : null) ||
        (position === 'after' ? originalOrderNo : null);
      this.addInvoiceRow(
        data,
        actualAddToTop,
        status,
        orderNo || data.merchant_order_no,
        actualInsertAfter
      );
    });
  }


  refresh(filterState) {
    if (filterState && filterState.filterStatus) {
      this.applyTableFilter(filterState.filterStatus);
    }

    if (filterState && filterState.invoices) {
      this.clearTable();
      const formattedInvoices = filterState.invoices.map((invoice, index) => ({
        ...invoice,
        _index: index + 1
      }));
      this.populateInvoiceTable(formattedInvoices, []);
      this.showTable();
    }
  }

  renderSnapshot(snapshot) {
    if (!snapshot) return;

    const { invoices = [], statistics = null, filterStatus = 'all' } = snapshot;

    this.clearTable();
    if (invoices.length > 0) {
      const formattedInvoices = invoices.map((invoice, index) => ({
        ...invoice,
        _index: index + 1
      }));
      this.populateInvoiceTable(formattedInvoices, []);
      this.showTable();
    }

    if (filterStatus !== 'all') {
      this.applyTableFilter(filterStatus);
    }

    this.updateTableVisibility(invoices.length > 0);
  }

  updateRow(orderNo, payload = {}) {
    if (!orderNo) {
      return;
    }

    const { data, status, error, invoiceNumber } = payload;
    const existingData = this.dataEngine?.getInvoice?.(orderNo);
    const mergedData = {
      ...(existingData ? { ...existingData } : {}),
      ...(data ? { ...data } : {})
    };

    if (!Object.keys(mergedData).length) {
      return;
    }

    if (status) {
      mergedData._status = status;
    }

    if (error !== undefined) {
      if (error === null || error === '') {
        delete mergedData._error;
      } else {
        mergedData._error = error;
      }
    }

    if (invoiceNumber) {
      mergedData.invoiceNumber = invoiceNumber;
    }

    this.updateTableRowDisplay(orderNo, mergedData);
  }

  applyTableFilter(filterStatus) {
    const tableBody = document.getElementById('invoiceTableBody');
    if (!tableBody) return;

    const rows = tableBody.querySelectorAll('tr');
    let visibleRowCount = 0;

    rows.forEach(row => {
      const rowStatus = row.getAttribute('data-status');

      if (filterStatus === 'all' || rowStatus === filterStatus) {
        row.style.display = '';
        visibleRowCount++;
      } else {
        row.style.display = 'none';
      }
    });

    this.currentFilter = filterStatus;
    this.updateTableVisibility(visibleRowCount > 0);
  }


  updateInvoiceRow(formData) {
    const row = document.querySelector(`tr[data-order-no="${formData.orderNo}"]`);
    if (!row) return;

    const currentStatus = row.getAttribute('data-status');
    const preservedStatus = formData._status || currentStatus || 'pending';

    const newRow = this.createInvoiceRow(
      formData,
      preservedStatus,
      formData.orderNo,
      formData._error || null
    );

    row.parentNode.replaceChild(newRow, row);
  }

  updateTableVisibility(hasData) {
    const emptyState = document.getElementById('emptyState');
    const invoiceTable = document.getElementById('invoiceTable');

    if (hasData) {
      if (emptyState) emptyState.style.display = 'none';
      if (invoiceTable) invoiceTable.style.display = '';
    } else {
      if (emptyState) emptyState.style.display = 'block';
      if (invoiceTable) invoiceTable.style.display = 'none';
    }
  }

  addInvoiceToTable(eventPayload, options = {}) {
    if (!eventPayload) {
      return;
    }

    const invoiceData = eventPayload.data || eventPayload.invoiceData;
    const orderNo = eventPayload.id || eventPayload.orderNo || invoiceData?.merchant_order_no;

    if (!invoiceData || !orderNo) {
      return;
    }

    const tableBody =
      this.dom.invoiceTableBody || document.getElementById('invoiceTableBody');
    const existingRow = tableBody?.querySelector(`tr[data-order-no="${orderNo}"]`);

    if (existingRow) {
      this.updateRow(orderNo, { data: invoiceData, status: invoiceData._status });
      return;
    }

    const isNewInvoice =
      eventPayload.source === 'created' || eventPayload.source === 'manual_create';
    const isDuplicated =
      eventPayload.source === 'duplicated' || invoiceData._status === 'copy';

    this.insertRows(
      [
        {
          orderNo,
          data: invoiceData,
          status: invoiceData._status || 'pending',
          position: isNewInvoice ? 'top' : undefined,
          originalOrderNo: isDuplicated
            ? eventPayload.originalOrderNo || orderNo
            : null
        }
      ],
      options
    );
  }

  setPlatform(platform) {
    this.currentProvider = platform;
  }

  setController(controller) {
    this.controller = controller;
  }
}

export { TableManager };
