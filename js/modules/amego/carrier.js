/**
 * Amego Carrier Provider
 * Amego carrier configuration and validation
 */
import { CarrierInterface } from '../../core/carrier-interface.js';

export class AmegoCarrierProvider extends CarrierInterface {
  constructor() {
    super();
    this.config = {
      B2C: [
        { value: 'print', label: '列印發票' },
        { value: 'donate', label: '愛心碼捐贈' },
        { value: '3J0002', label: '手機條碼' },
        { value: 'CQ0001', label: '自然人憑證' },
        { value: 'amego', label: '光貿會員載具' }
      ],
      B2B: [
        { value: 'print', label: '列印發票', disabled: true }
      ]
    };

    this.types = {
      CQ0001: '自然人憑證',
      '3J0002': '手機條碼',
      amego: '光貿載具',
      donate: '捐贈'
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
    if (!type) return false;

    if (type === 'donate') {
      return num && /^[0-9]{3,7}$/.test(num);
    }

    const patterns = {
      2: /^[A-Z]{2}[0-9]{14}$/,
      CQ0001: /^[A-Z]{2}[0-9]{14}$/,
      3: /^\/[A-Z0-9+.-]{7}$/,
      '3J0002': /^\/[A-Z0-9+.-]{7}$/,
      4: /^.{8,}$/,
      5: /^.{8,}$/
    };

    return patterns[type] ? patterns[type].test(num) : false;
  }

  mapType(genericType) {
    const typeMap = {
      mobile: '3J0002',
      citizen: 'CQ0001',
      easycard: '4',
      ipass: '5',
      donation: 'donate'
    };

    return typeMap[genericType] || genericType;
  }

  formatNumber(type, num) {
    if (!num) return '';

    switch (type) {
      case 'CQ0001':
        return num.toUpperCase();

      case '3J0002':
        return num.startsWith('/') ? num : `/${num}`;

      case 'donate':
        return num.replace(/\D/g, '');

      case '4':
      case '5':
        return num.replace(/[-\s]/g, '');

      default:
        return num;
    }
  }

  getValidationRules() {
    return {
      'amego': {
        readOnly: true,
        text: '需於 Email 欄位填寫資料',
        supportingText: '需於 Email 欄位填寫資料'
      },
      'CQ0001': {
        pattern: '^[A-Z]{2}[0-9]{14}$',
        errorText: '自然人憑證格式為2字母+14數字',
        supportingText: '請輸入自然人憑證號碼',
        required: true,
        maxlength: 16
      },
      '3J0002': {
        pattern: '^\\/[A-Z0-9+.\\-]{7}$',
        errorText: '手機條碼格式為/開頭+7位字符',
        supportingText: '請輸入手機條碼載具',
        required: true,
        maxlength: 8
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
        pattern: '^.{8,}$',
        errorText: '悠遊卡號碼至少8位字元',
        supportingText: '請輸入悠遊卡卡號',
        required: true,
        maxlength: 20
      },
      '5': {
        pattern: '^.{8,}$',
        errorText: 'iPass號碼至少8位字元',
        supportingText: '請輸入iPass卡號',
        required: true,
        maxlength: 20
      },
      'donate': {
        pattern: '^[0-9]{3,7}$',
        errorText: '愛心碼必須為3-7位數字',
        supportingText: '請輸入愛心碼',
        required: true,
        maxlength: 7
      }
    };
  }
}
