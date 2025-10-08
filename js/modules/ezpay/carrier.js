/**
 * EzPay Carrier Provider
 * EzPay carrier configuration and validation
 */
import { CarrierInterface } from '../../core/carrier-interface.js';

export class EzpayCarrierProvider extends CarrierInterface {
  constructor() {
    super();
    this.config = {
      B2C: [
        { value: 'print', label: '列印發票' },
        { value: 'donate', label: '愛心碼捐贈' },
        { value: '0', label: '手機條碼載具' },
        { value: '1', label: '自然人憑證載具' },
        { value: '2', label: 'ezPay電子發票載具' }
      ],
      B2B: [
        { value: 'print', label: '列印發票', disabled: true }
      ]
    };

    this.types = {
      0: '手機條碼',
      1: '自然人憑證',
      2: 'ezPay 載具'
    };
  }

  getCarrierConfig(category) {
    return this.config[category] || this.config.B2C;
  }

  describeCarrier(code) {
    const found = Object.values(this.config).flat().find((item) => item.value === code);
    return found ? found.label : '';
  }

  validate(type, num) {
    switch (type) {
      case '0':
        return /^\/[A-Z0-9+.\-]{7}$/.test(num);

      case '1':
        return /^[A-Z]{2}[0-9]{14}$/.test(num);

      case '2':
        return true;

      case 'donate':
        return num && /^[0-9]{3,7}$/.test(num);

      default:
        return false;
    }
  }

  mapType(genericType) {
    const typeMap = {
      mobile: '0',
      citizen: '1',
      platform: '2'
    };

    return typeMap[genericType] || genericType;
  }

  formatNumber(type, num) {
    if (!num) return '';

    switch (type) {
      case '0':
        return num.startsWith('/') ? num : `/${num}`;

      case '1':
        return num.toUpperCase();

      case '2':
        return '';

      default:
        return num;
    }
  }

  getValidationRules() {
    return {
      '0': {
        pattern: '^\\/[A-Z0-9+.\\-]{7}$',
        errorText: '手機條碼格式為/開頭+7位字符',
        supportingText: '請輸入手機條碼載具',
        required: true,
        maxlength: 8
      },
      '1': {
        pattern: '^[A-Z]{2}[0-9]{14}$',
        errorText: '自然人憑證格式為2字母+14數字',
        supportingText: '請輸入自然人憑證號碼',
        required: true,
        maxlength: 16
      },
      '2': {
        readOnly: true,
        text: 'ezPay載具需於 Email 或手機欄位填寫資料',
        supportingText: 'ezPay載具需於 Email 或手機欄位填寫資料'
      },
      'donate': {
        pattern: '^[0-9]{3,7}$',
        errorText: '愛心碼必須為3-7位數字',
        supportingText: '請輸入愛心碼',
        required: true,
        maxlength: 7
      },
      'print': {
        readOnly: true,
        text: '',
        supportingText: ''
      }
    };
  }
}
