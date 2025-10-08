/**
 * ECPay Crypto Module
 * ECPay invoice encryption and decryption processing
 */

export class EcpayCrypto {
  async encrypt(data, config) {
    try {
      if (!config) return { success: false, error: 'Platform configuration is required' };
      
      const requiredFields = ['merchant_id', 'hash_key', 'hash_iv'];
      for (const field of requiredFields) {
        if (!config[field]) {
          return { success: false, error: `Missing ${field} in ECPay configuration` };
        }
        if (this.isPlaceholder(config[field])) {
          return { success: false, error: `Invalid ${field} in ECPay configuration: placeholder detected` };
        }
      }
      
      const { merchant_id, hash_key, hash_iv } = config;

      const ecpayData = this.transformToEcPayFormat(data);
      ecpayData.MerchantID = merchant_id;

      const jsonStr = JSON.stringify(ecpayData);
      const urlEncoded = encodeURIComponent(jsonStr);
      const encrypted = await this.aesEncrypt(urlEncoded, hash_key, hash_iv);

      return {
        success: true,
        platform: 'ecpay',
        data: {
          MerchantID: merchant_id,
          RqHeader: {
            Timestamp: Math.floor(Date.now() / 1000),
            Revision: '3.0.0'
          },
          Data: encrypted
        }
      };
    } catch (error) {
      return { success: false, platform: 'ecpay', error: error.message };
    }
  }

  transformToEcPayFormat(invoice) {
    const items = [];
    let itemsTotal = 0;

    invoice.items.forEach((item, index) => {
      const count = item.count || 1;
      const price = Math.floor(item.price);
      const itemAmount = Math.floor(item.amt || 0);
      itemsTotal += itemAmount;

      items.push({
        ItemSeq: index + 1,
        ItemName: item.name,
        ItemCount: count,
        ItemWord: item.unit || '個',
        ItemPrice: price,
        ItemAmount: itemAmount,
        ItemTaxType: item.tax_type || '1'
      });
    });

    const ecpayData = {
      MerchantID: '',
      RelateNumber: invoice.merchant_order_no,
      Print:
        invoice.category === 'B2B'
          ? '1'
          : invoice.print_flag === 'Y'
            ? '1'
            : '0',
      Donation: '0',
      TaxType: this.mapTaxType(invoice.tax_type || '1'),
      SalesAmount: itemsTotal,
      InvType: this.getInvoiceType(invoice.tax_type || '1'),
      Items: items
    };

    if (ecpayData.Print === '1') {
      ecpayData.CustomerName = invoice.buyer_name;
      ecpayData.CustomerAddr = invoice.buyer_address || '';
    }

    if (invoice.category === 'B2C' && invoice.buyer_name) {
      ecpayData.CustomerName = invoice.buyer_name;
    }

    if (invoice.buyer_email) {
      ecpayData.CustomerEmail = invoice.buyer_email;
    }
    if (invoice.buyer_phone) {
      ecpayData.CustomerPhone = invoice.buyer_phone.replace(/[-\s]/g, '');
    }

    if (invoice.carrier_type) {
      if (invoice.carrier_type === 'donate') {
        ecpayData.Donation = '1';
        ecpayData.LoveCode = invoice.carrier_num;
        ecpayData.Print = '0';
      } else {
        ecpayData.CarrierType = invoice.carrier_type;

        if (ecpayData.CarrierType === '1') {
          ecpayData.CarrierNum = '';
        } else if (['4', '5'].includes(ecpayData.CarrierType)) {
          ecpayData.CarrierNum = invoice.carrier_num || '';
          ecpayData.CarrierNum2 =
            invoice.carrier_num2 || invoice.carrier_num || '';
        } else if (invoice.carrier_num) {
          ecpayData.CarrierNum = invoice.carrier_num;
        }

        ecpayData.Print = '0';
      }
    }

    if (invoice.tax_type === '9') {
      ecpayData.SalesAmount = Math.round(invoice.sales_amount || 0);
      ecpayData.FreeTaxSalesAmount = Math.round(invoice.free_tax_sales_amount || 0);
      ecpayData.ZeroTaxSalesAmount = 0;
    }

    if (invoice.tax_type === '2' || invoice.tax_type === '9') {
      const clearanceMark = invoice.customs_clearance || '2';
      ecpayData.ClearanceMark = String(clearanceMark);
    }

    if (invoice.category === 'B2B' && invoice.buyer_ubn) {
      ecpayData.CustomerIdentifier = invoice.buyer_ubn;
    }

    return ecpayData;
  }

  mapTaxType(taxType) {
    const map = {
      1: '1',
      2: '2',
      3: '3',
      9: '9'
    };
    return map[taxType] || '1';
  }

  getInvoiceType(taxType) {
    if (taxType === '9') return '08';
    return '07';
  }


  async aesEncrypt(data, key, iv) {
    try {
      const keyBuffer = new TextEncoder().encode(key.padEnd(16, '\0').substring(0, 16));
      const ivBuffer = new TextEncoder().encode(iv.padEnd(16, '\0').substring(0, 16));
      const dataBuffer = new TextEncoder().encode(data);

      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBuffer,
        { name: 'AES-CBC' },
        false,
        ['encrypt']
      );

      const encrypted = await crypto.subtle.encrypt(
        {
          name: 'AES-CBC',
          iv: ivBuffer
        },
        cryptoKey,
        dataBuffer
      );

      const base64 = btoa(String.fromCharCode(...new Uint8Array(encrypted)));
      return base64;
    } catch (error) {
      return { success: false, error: 'ECPay encryption failed: ' + error.message };
    }
  }

  async decrypt(responseData, key, iv) {
    try {
      if (typeof responseData === 'object' && responseData.Data) {
        const decryptedData = await this.aesDecrypt(responseData.Data, key, iv);
        return {
          ...responseData,
          Data: decryptedData
        };
      }

      if (typeof responseData === 'string') {
        return await this.aesDecrypt(responseData, key, iv);
      }
      return responseData;
    } catch (error) {
      return { success: false, error: 'ECPay decryption failed: ' + error.message };
    }
  }

  async aesDecrypt(encryptedData, key, iv) {
    try {
      const keyBuffer = new TextEncoder().encode(key.padEnd(16, '\0').substring(0, 16));
      const ivBuffer = new TextEncoder().encode(iv.padEnd(16, '\0').substring(0, 16));
      const encryptedBuffer = Uint8Array.from(atob(encryptedData), (c) =>
        c.charCodeAt(0)
      );

      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBuffer,
        { name: 'AES-CBC' },
        false,
        ['decrypt']
      );

      const decrypted = await crypto.subtle.decrypt(
        {
          name: 'AES-CBC',
          iv: ivBuffer
        },
        cryptoKey,
        encryptedBuffer
      );

      const decryptedText = new TextDecoder().decode(decrypted);
      const urlDecoded = decodeURIComponent(decryptedText);
      return JSON.parse(urlDecoded);
    } catch (error) {
      return { success: false, error: 'ECPay AES decryption failed: ' + error.message };
    }
  }

  isPlaceholder(value) {
    if (!value || typeof value !== 'string') return true;
    return /^YOUR_|^XXX+$|^000+$|^\s*$/.test(value);
  }
}
