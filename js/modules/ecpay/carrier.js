/**
 * ECPay Carrier Provider
 * ECPay carrier configuration and validation
 */
import { CarrierInterface } from '../../core/carrier-interface.js';

export class EcpayCarrierProvider extends CarrierInterface {
  constructor() {
    super();
    this.config = {
      B2C: [
        { value: 'print', label: '列印發票' },
        { value: 'donate', label: '愛心碼捐贈' },
        { value: '3', label: '手機條碼' },
        { value: '2', label: '自然人憑證' },
        { value: '1', label: '綠界載具' },
        { value: '4', label: '悠遊卡' },
        { value: '5', label: '一卡通' }
      ],
      B2B: [
        { value: 'print', label: '列印發票', disabled: true }
      ]
    };

    this.types = {
      1: '綠界載具',
      2: '自然人憑證',
      3: '手機條碼',
      4: '悠遊卡',
      5: '一卡通'
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
      case '1':
        return true;

      case '2':
        return /^[A-Z]{2}[0-9]{14}$/.test(num);

      case '3':
        return /^\/[A-Z0-9+-.]{7}$/.test(num);

      case '4':
        return num && num.length >= 8;

      case '5':
        return num && num.length >= 8;

      case 'donate':
        return num && /^[0-9]{3,7}$/.test(num);

      default:
        return false;
    }
  }

  mapType(genericType) {
    const typeMap = {
      member: '1',
      natural: '2',
      mobile: '3',
      easycard: '4',
      ipass: '5'
    };

    return typeMap[genericType] || genericType;
  }

  formatNumber(type, num) {
    if (!num) return '';

    switch (type) {
      case '2':
        return num.toUpperCase();

      case '3':
        return num.startsWith('/') ? num : `/${num}`;

      case '4':
      case '5':
        return num.replace(/[-\s]/g, '');

      default:
        return num;
    }
  }

  getValidationRules() {
    return {
      '1': {
        readOnly: true,
        text: '綠界載具需於 Email 或手機欄位填寫資料',
        supportingText: '綠界載具需於 Email 或手機欄位填寫資料'
      },
      '2': {
        pattern: '^[A-Z]{2}[0-9]{14}$',
        errorText: '自然人憑證格式為2字母+14數字',
        supportingText: '請輸入自然人憑證號碼',
        required: true,
        maxlength: 16
      },
      '3': {
        pattern: '^\\/[A-Z0-9+.\\-]{7}$',
        errorText: '手機條碼格式為/開頭+7位字符',
        supportingText: '請輸入手機條碼載具',
        required: true,
        maxlength: 8
      },
      '4': {
        pattern: '^[0-9]{16}$',
        errorText: '悠遊卡必須為16位數字',
        supportingText: '請輸入悠遊卡卡號',
        required: true,
        maxlength: 16
      },
      '5': {
        pattern: '^[0-9]{16}$',
        errorText: '一卡通必須為16位數字',
        supportingText: '請輸入一卡通卡號',
        required: true,
        maxlength: 16
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
        text: '列印發票需填寫 Email 欄位或手機欄位擇一',
        supportingText: '列印發票需填寫 Email 欄位或手機欄位擇一'
      }
    };
  }
}
