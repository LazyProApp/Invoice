/**
 * Utils Module
 * Common utility functions
 */

export class Utils {
  static getActiveTaxElements() {
    return {
      taxType: document.getElementById('editTaxType'),
      taxRate: document.getElementById('editTaxRate')
    };
  }

  static formatTaiwanCurrency(amount) {
    return Math.round(amount).toLocaleString('zh-TW');
  }

  static formatNumber(num, options = {}) {
    if (options.currency) {
      return Math.round(num).toLocaleString('zh-TW');
    }
    return num.toLocaleString();
  }

  static delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  static escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }

}
