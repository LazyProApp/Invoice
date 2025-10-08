export class ExportManager {
  constructor(eventBus, dataEngine) {
    this.eventBus = eventBus;
    this.dataEngine = dataEngine;
  }

  async handleExport(options = {}) {
    const invoices = await this.collectInvoiceData();

    if (invoices.length === 0) {
      return;
    }

    await this.exportAsJSON(invoices);
  }

  async collectInvoiceData() {
    const invoices = [];

    const allInvoices = this.dataEngine.getAllInvoices();

    for (const invoice of allInvoices) {
      if (invoice) {
        const cleanData = this.cleanInvoiceData(invoice);
        invoices.push(cleanData);
      }
    }

    return invoices;
  }

  cleanInvoiceData(invoice) {
    const cleanData = { ...invoice };

    delete cleanData._status;
    delete cleanData._invoice_number;
    delete cleanData._error;
    delete cleanData._index;

    return cleanData;
  }

  async exportAsJSON(invoices) {
    const jsonString = JSON.stringify(invoices, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });

    this.downloadBlob(blob, this.generateFileName());
  }

  downloadBlob(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    window.URL.revokeObjectURL(url);
  }

  generateFileName() {
    return `invoices-${new Date().toISOString().slice(0, 10)}.json`;
  }
}
