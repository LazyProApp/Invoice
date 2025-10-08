/**
 * EzPay Crypto Module
 * EzPay invoice encryption and decryption processing
 */

export class EzpayCrypto {
  async encrypt(data, config) {
    try {
      if (!config) return { success: false, error: 'Platform configuration is required' };
      
      const requiredFields = ['merchant_id', 'hash_key', 'hash_iv'];
      for (const field of requiredFields) {
        if (!config[field]) {
          return { success: false, error: `Missing ${field} in EzPay configuration` };
        }
        if (this.isPlaceholder(config[field])) {
          return { success: false, error: `Invalid ${field} in EzPay configuration: placeholder detected` };
        }
      }
      
      const { merchant_id, hash_key, hash_iv } = config;

      const ezpayData = this.transformToEzPayFormat(data);

      const queryString = Object.keys(ezpayData)
        .sort()
        .map((key) => `${key}=${encodeURIComponent(ezpayData[key])}`)
        .join('&');

      const encrypted = await this.aesEncrypt(queryString, hash_key, hash_iv);

      return {
        success: true,
        platform: 'ezpay',
        data: {
          MerchantID_: merchant_id,
          PostData_: encrypted
        }
      };
    } catch (error) {
      return { success: false, platform: 'ezpay', error: error.message };
    }
  }

  transformToEzPayFormat(invoice) {
    const ezpayData = {
      RespondType: 'JSON',
      Version: '1.5',
      TimeStamp: Math.floor(Date.now() / 1000),
      MerchantOrderNo: invoice.merchant_order_no,
      Status: '1',
      Category: invoice.category,
      BuyerName: invoice.buyer_name,
      PrintFlag: invoice.print_flag,
      TaxType: invoice.tax_type,
      TaxRate: invoice.tax_rate || 5,
      Amt: Math.round(invoice.amt || 0),
      TaxAmt: Math.round(invoice.tax_amt || 0),
      TotalAmt: Math.round(invoice.total_amt || invoice.amt + invoice.tax_amt || 0),
      ItemName: invoice.items.map((item) => item.name).join('|'),
      ItemCount: invoice.items.map((item) => item.count).join('|'),
      ItemUnit: invoice.items.map((item) => item.unit || '個').join('|'),
      ItemPrice: invoice.items.map((item) => item.price).join('|'),
      ItemAmt: invoice.items.map((item) => item.amt || 0).join('|'),
      ItemTaxType: invoice.items.map((item) => item.tax_type || '1').join('|'),
      BuyerEmail: invoice.buyer_email || ''
    };

    if (invoice.carrier_type) {
      if (invoice.carrier_type === 'donate') {
        ezpayData.LoveCode = invoice.carrier_num;
        ezpayData.PrintFlag = 'N';
      } else {
        ezpayData.CarrierType = invoice.carrier_type;
        if (invoice.carrier_num) {
          ezpayData.CarrierNum = invoice.carrier_num;
        }
        ezpayData.PrintFlag = 'N';
      }
    }

    if (invoice.carrier_type === '2' && invoice.kiosk_print_flag === '1') {
      ezpayData.KioskPrintFlag = '1';
    }

    if (invoice.category === 'B2B') {
      if (invoice.buyer_ubn) ezpayData.BuyerUBN = invoice.buyer_ubn;
      if (invoice.buyer_address) ezpayData.BuyerAddress = invoice.buyer_address;
      if (invoice.buyer_email) ezpayData.BuyerEmail = invoice.buyer_email;
      if (invoice.buyer_phone) ezpayData.BuyerPhone = invoice.buyer_phone;
    }

    if (invoice.category === 'B2C') {
      if (
        invoice.print_flag === 'N' &&
        !ezpayData.CarrierType &&
        !ezpayData.CarrierNum &&
        !ezpayData.LoveCode &&
        invoice.buyer_email
      ) {
        ezpayData.CarrierType = '2';
        ezpayData.CarrierNum = invoice.buyer_email;
      }

      if (invoice.buyer_phone) ezpayData.BuyerPhone = invoice.buyer_phone;
      if (invoice.buyer_address) ezpayData.BuyerAddress = invoice.buyer_address;
    }

    if (invoice.tax_type === '2' || invoice.tax_type === 2) {
      ezpayData.TaxRate = 0;
      if (invoice.clearance_mark || invoice.customs_clearance) {
        ezpayData.CustomsClearance = String(
          invoice.clearance_mark || invoice.customs_clearance
        );
      }
    }

    if (invoice.tax_type === '3' || invoice.tax_type === 3) {
      ezpayData.TaxRate = 0;
    }

    if (invoice.tax_type === '9' || invoice.tax_type === 9) {
      const taxableAmt = invoice.sales_amount || 0;
      const freeAmt = invoice.free_tax_sales_amount || 0;

      ezpayData.AmtSales = taxableAmt;
      ezpayData.AmtFree = freeAmt;
      ezpayData.AmtZero = 0;
    }

    return ezpayData;
  }

  async aesEncrypt(data, key, iv) {
    try {
      const keyBuffer = new TextEncoder().encode(
        key.padEnd(32, '\0').substring(0, 32)
      );
      const ivBuffer = new TextEncoder().encode(
        iv.padEnd(16, '\0').substring(0, 16)
      );
      const dataBuffer = new TextEncoder().encode(data);

      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBuffer,
        { name: 'AES-CBC' },
        false,
        ['encrypt']
      );

      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-CBC', iv: ivBuffer },
        cryptoKey,
        dataBuffer
      );

      return Array.from(new Uint8Array(encrypted))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    } catch (error) {
      return { success: false, error: 'AES encryption failed: ' + error.message };
    }
  }

  async decrypt(encryptedData, key, iv) {
    try {
      if (typeof encryptedData === 'object') {
        return encryptedData;
      }

      const keyBuffer = new TextEncoder().encode(
        key.padEnd(32, '\0').substring(0, 32)
      );
      const ivBuffer = new TextEncoder().encode(
        iv.padEnd(16, '\0').substring(0, 16)
      );

      const encryptedBuffer = new Uint8Array(
        encryptedData.match(/.{1,2}/g).map((byte) => parseInt(byte, 16))
      );

      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBuffer,
        { name: 'AES-CBC' },
        false,
        ['decrypt']
      );

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-CBC', iv: ivBuffer },
        cryptoKey,
        encryptedBuffer
      );

      const decryptedText = new TextDecoder().decode(decrypted);
      return JSON.parse(decryptedText);
    } catch (error) {
      return { success: false, error: 'EzPay decryption failed: ' + error.message };
    }
  }

  isPlaceholder(value) {
    if (!value || typeof value !== 'string') return true;
    return /^YOUR_|^XXX+$|^000+$|^\s*$/.test(value);
  }
}
