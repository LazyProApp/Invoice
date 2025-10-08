/**
 * OPay Carrier Provider
 * OPay carrier configuration and validation
 */
import { CarrierInterface } from '../../core/carrier-interface.js';

export class OpayCarrierProvider extends CarrierInterface {
  constructor() {
    super();
    this.config = {
      B2C: [
        { value: 'print', label: '列印發票' },
        { value: 'donate', label: '愛心碼捐贈' },
        { value: '3', label: '手機條碼載具' },
        { value: '2', label: '自然人憑證號碼' },
        { value: '1', label: '歐付寶電子發票載具' },
        { value: '4', label: '悠遊卡' },
        { value: '5', label: 'icash' },
        { value: '6', label: '一卡通' },
        { value: '7', label: '金融卡' },
        { value: '8', label: '信用卡' }
      ],
      B2B: [
        { value: 'print', label: '列印發票', disabled: true }
      ]
    };

    this.types = {
      1: 'OPay 載具',
      2: '自然人憑證',
      3: '手機條碼',
      4: '悠遊卡',
      5: 'icash',
      6: '一卡通',
      7: '金融卡',
      8: '信用卡'
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
    const patterns = {
      2: /^[A-Z]{2}[0-9]{14}$/,
      3: /^\/[A-Z0-9+.-]{7}$/,
      4: /^[0-9]{16}$/,
      6: /^[0-9]{16}$/,
      7: /^[0-9]{16}$/,
      8: /^[0-9]{16}$/
    };

    if (type === '1') {
      return true;
    }

    if (type === 'donate') {
      return num && /^[0-9]{3,7}$/.test(num);
    }

    const pattern = patterns[type];
    if (!pattern) {
      return false;
    }

    return pattern.test(num);
  }

  mapType(genericType) {
    const mapping = {
      mobile: '3',
      citizen: '2',
      platform: '1',
      easycard: '4',
      ipass: '6',
      debitcard: '7',
      creditcard: '8'
    };

    return mapping[genericType] || genericType;
  }

  formatNumber(type, num) {
    if (!num) return '';

    switch (type) {
      case '2':
        return num.toUpperCase();

      case '3':
        return num.startsWith('/') ? num : `/${num}`;

      case '4':
      case '6':
      case '7':
      case '8':
        return num.replace(/[-\s]/g, '');

      default:
        return num;
    }
  }

  processCarrierInfo(carrierType, carrierNum, additionalData = {}) {
    if (carrierType === 'donate') {
      return {
        CarrierType: '',
        CarrierNum: '',
        Donation: additionalData.donationCode || ''
      };
    }

    const mappedType = this.mapType(carrierType);

    return {
      CarrierType: mappedType,
      CarrierNum: carrierNum || '',
      Donation: ''
    };
  }

  getValidationRules() {
    return {
      '1': {
        readOnly: true,
        text: '歐付寶載具需於 Email 或手機欄位填寫資料',
        supportingText: '歐付寶載具需於 Email 或手機欄位填寫資料'
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
        pattern: '^.{8,}$',
        errorText: 'icash卡號至少8位字元',
        supportingText: '請輸入icash卡號',
        required: true,
        maxlength: 20
      },
      '6': {
        pattern: '^[0-9]{16}$',
        errorText: '一卡通必須為16位數字',
        supportingText: '請輸入一卡通卡號',
        required: true,
        maxlength: 16
      },
      '7': {
        pattern: '^[0-9]{16}$',
        errorText: '金融卡必須為16位數字',
        supportingText: '請輸入金融卡卡號',
        required: true,
        maxlength: 16
      },
      '8': {
        pattern: '^[0-9]{16}$',
        errorText: '信用卡必須為16位數字',
        supportingText: '請輸入信用卡卡號',
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
        text: '列印發票地址欄為必填及 Email 欄位或手機欄位擇一',
        supportingText: '列印發票地址欄為必填及 Email 欄位或手機欄位擇一'
      }
    };
  }
}
