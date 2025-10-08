/**
 * OPay Crypto Module
 * OPay invoice encryption and decryption processing
 */

export class OpayCrypto {
  async encrypt(invoiceData, config) {
    try {
      if (!config) return { success: false, error: 'Platform configuration is required' };
      
      const requiredFields = ['merchant_id', 'hash_key', 'hash_iv'];
      for (const field of requiredFields) {
        if (!config[field]) {
          return { success: false, error: `Missing ${field} in OPay configuration` };
        }
        if (this.isPlaceholder(config[field])) {
          return { success: false, error: `Invalid ${field} in OPay configuration: placeholder detected` };
        }
      }
      
      const { merchant_id, hash_key, hash_iv } = config;

      const is_b2b = Boolean(invoiceData.buyer_ubn);
      const opayData = this.transformToOPayFormat(invoiceData, is_b2b, {
        merchant_id,
        hash_key,
        hash_iv
      });

      const crypto_instance = {
        encrypt: async (data) => {
          const json_data = JSON.stringify(data);
          const url_encoded = encodeURIComponent(json_data);

          const key_buffer = new TextEncoder().encode(hash_key.padEnd(16, '\0').substring(0, 16));
          const iv_buffer = new TextEncoder().encode(hash_iv.padEnd(16, '\0').substring(0, 16));
          const data_buffer = new TextEncoder().encode(url_encoded);

          const crypto_key = await crypto.subtle.importKey(
            'raw',
            key_buffer,
            { name: 'AES-CBC' },
            false,
            ['encrypt']
          );

          const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-CBC', iv: iv_buffer },
            crypto_key,
            data_buffer
          );

          return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
        }
      };

      const encrypted_data = await crypto_instance.encrypt(opayData);

      return {
        success: true,
        data: {
          MerchantID: merchant_id,
          RqHeader: {
            Timestamp: Math.floor(Date.now() / 1000)
          },
          Data: encrypted_data
        },
        platform: 'opay'
      };
    } catch (error) {
      return { success: false, platform: 'opay', error: error.message };
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
      return { success: false, error: 'OPay decryption failed: ' + error.message };
    }
  }

  async aesDecrypt(encrypted_data, key, iv) {
    try {
      const decoded_buffer = Uint8Array.from(atob(encrypted_data), (c) =>
        c.charCodeAt(0)
      );

      const key_buffer = new TextEncoder().encode(key.padEnd(16, '\0').substring(0, 16));
      const iv_buffer = new TextEncoder().encode(iv.padEnd(16, '\0').substring(0, 16));

      const crypto_key = await crypto.subtle.importKey(
        'raw',
        key_buffer,
        { name: 'AES-CBC' },
        false,
        ['decrypt']
      );

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-CBC', iv: iv_buffer },
        crypto_key,
        decoded_buffer
      );

      const url_decoded = decodeURIComponent(
        new TextDecoder().decode(decrypted)
      );
      return JSON.parse(url_decoded);
    } catch (error) {
      return { success: false, error: 'OPay AES decryption failed: ' + error.message };
    }
  }

  transformToOPayFormat(data, is_b2b, credentials) {
    if (is_b2b && data.tax_type === '9') {
      return { success: false, error: "O'Pay B2B API 不支援混合課稅 (TaxType=9)" };
    }

    let salesAmount = 0;
    if (data.items && data.items.length > 0) {
      data.items.forEach(item => {
        const count = item.count || 1;
        const price = item.price || 0;
        salesAmount += Math.floor(price * count);
      });
    }

    const opay_data = {
      MerchantID: credentials.merchant_id,
      RelateNumber: data.relate_number || data.merchant_order_no || this.generateRelateNumber(),
      TaxType: this.mapTaxType(data.tax_type),
      SalesAmount: salesAmount,
      InvType: this.mapInvType(data.tax_type),
      Items: this.transformItems(
        data.items,
        is_b2b,
        data.tax_type,
        data.tax_rate || 5
      )
    };

    if (data.tax_type === '4' && data.tax_rate) {
      opay_data.TaxRate = parseFloat(data.tax_rate) / 100;
    }

    if (is_b2b) {
      opay_data.TaxAmount = Math.round(data.tax_amt || 0);
      opay_data.TotalAmount = Math.round(data.total_amt || 0);

      opay_data.CustomerIdentifier = data.buyer_ubn;
      opay_data.CustomerName = data.buyer_name;
      opay_data.Print = '1';

      if (data.buyer_email) {
        opay_data.CustomerEmail = data.buyer_email;
      }
      if (data.buyer_phone) {
        opay_data.CustomerTelephoneNumber = data.buyer_phone;
      }
      if (data.buyer_address) {
        opay_data.CustomerAddress = data.buyer_address;
      }
      
      if (data.invoice_remark) {
        opay_data.InvoiceRemark = data.invoice_remark;
      }


      if (data.tax_type === '2') {
        opay_data.ClearanceMark = data.clearance_mark || '2';
      } else if (data.clearance_mark) {
        opay_data.ClearanceMark = data.clearance_mark;
      }
    } else {
      if (data.carrier_type === 'donate') {
        opay_data.Donation = '1';
        opay_data.LoveCode = data.carrier_num;
        opay_data.Print = '0';
      } else {
        opay_data.Donation = data.donation ? String(data.donation) : '0';
        if (opay_data.Donation === '1' && data.love_code) {
          opay_data.LoveCode = data.love_code;
        }

        if (opay_data.Donation === '1' || data.carrier_type) {
          opay_data.Print = '0';
        } else if (data.print_flag === 'Y' || data.print === '1') {
          opay_data.Print = '1';
        } else {
          opay_data.Print = '0';
        }
      }

      if (data.buyer_ubn) {
        opay_data.CustomerIdentifier = data.buyer_ubn;
        opay_data.CustomerName = data.buyer_name;
      } else if (opay_data.Print === '1' && data.buyer_name) {
        opay_data.CustomerName = data.buyer_name;
        if (data.buyer_address) {
          opay_data.CustomerAddr = data.buyer_address;
        }
      }

      if (data.buyer_email) {
        opay_data.CustomerEmail = data.buyer_email;
      } else if (data.buyer_phone) {
        opay_data.CustomerPhone = data.buyer_phone;
      }

      const carrier_result = this.processCarrierInfo(data);
      if (carrier_result) {
        Object.assign(opay_data, carrier_result);
      }

      if (data.tax_type === '2' && data.clearance_mark) {
        opay_data.ClearanceMark = data.clearance_mark;
      }

      opay_data.vat = '1';
    }

    return opay_data;
  }

  transformItems(items, is_b2b = false, tax_type = '1', tax_rate = 5) {
    const opay_items = [];

    items.forEach((item, index) => {
      const qty = parseFloat(item.quantity || item.count || 1);
      const price = parseFloat(item.price);
      const amount = parseFloat(item.amt || 0);

      const item_data = {
        ItemSeq: index + 1,
        ItemName: item.name,
        ItemCount: qty,
        ItemWord: item.unit || '件',
        ItemPrice: price,
        ItemAmount: amount
      };

      if (is_b2b) {
        item_data.ItemTax = parseFloat(item.item_tax || 0);
      }

      if (!is_b2b && tax_type === '9') {
        const item_tax_type = item.tax_type || '1';
        item_data.ItemTaxType = item_tax_type;
      }

      opay_items.push(item_data);
    });

    return opay_items;
  }

  mapTaxType(tax_type) {
    switch (tax_type) {
      case '1':
        return '1';
      case '2':
        return '2';
      case '3':
        return '3';
      case '4':
        return '4';
      case '9':
        return '9';
      default:
        return '1';
    }
  }

  mapInvType(tax_type) {
    if (tax_type === '4') {
      return '08';
    }
    return '07';
  }

  processCarrierInfo(data) {
    if (data.print === '1' || data.print_flag === 'Y') {
      return null;
    }

    if (!data.carrier_type) {
      return null;
    }

    if (data.carrier_type === 'donate') {
      return null;
    }

    const carrier_type = data.carrier_type;
    const carrier_num = data.carrier_num || '';

    return this.validateAndProcessCarrier(carrier_type, carrier_num, data);
  }

  validateAndProcessCarrier(carrier_type, carrier_num, data) {
    switch (carrier_type) {
      case '1':
        return {
          CarrierType: '1',
          CarrierNum: ''
        };

      case '2':
        if (!/^[A-Z]{2}[0-9]{14}$/.test(carrier_num)) {
          return {
            CarrierType: '1',
            CarrierNum: ''
          };
        }
        return {
          CarrierType: '2',
          CarrierNum: carrier_num
        };

      case '3':
        if (!/^\/[0-9A-Z+\-\.]{7}$/.test(carrier_num)) {
          carrier_num = '/ABC1234';
        }
        return {
          CarrierType: '3',
          CarrierNum: carrier_num
        };

      case '4':
      case '5':
      case '6':
      case '7':
        return {
          CarrierType: carrier_type,
          CarrierNum: carrier_num || 'hidden_code_example',
          CarrierNum2: 'display_code_example'
        };

      case '8':
        if (!carrier_num) {
          return { success: false, error: '信用卡載具號碼不可為空' };
        }

        let carrier_num2 = '';
        if (data.carrier_num2) {
          carrier_num2 = data.carrier_num2;
        } else {
          const roc_year = new Date().getFullYear() - 1911;
          const month = String(new Date().getMonth() + 1).padStart(2, '0');
          const day = String(new Date().getDate()).padStart(2, '0');
          const date_part = String(roc_year).padStart(3, '0') + month + day;
          const amount_part = '0000001000';
          carrier_num2 = date_part + amount_part;
        }

        return {
          CarrierType: '8',
          CarrierNum: carrier_num,
          CarrierNum2: carrier_num2
        };

      default:
        return null;
    }
  }

  calculateMixedTaxAmount(data) {
    let tax_amount = 0;

    if (data.items && Array.isArray(data.items)) {
      data.items.forEach((item) => {
        const item_tax_type = item.tax_type || '1';
        const item_amount = parseFloat(item.amt || item.price || 0);

        switch (item_tax_type) {
          case '1':
            tax_amount += Math.round(item_amount * 0.05);
            break;
          case '4':
            const tax_rate = (data.tax_rate || 25) / 100;
            tax_amount += Math.round(item_amount * tax_rate);
            break;
          case '2':
          case '3':
          default:
            break;
        }
      });
    }

    return tax_amount;
  }

  generateRelateNumber() {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const uniqueStr = Math.random().toString(36).slice(2, 8);
    return 'OPAY' + dateStr + uniqueStr;
  }

  async encryptCustomerData(customerData, config) {
    try {
      if (!config) return { success: false, error: 'Platform configuration is required' };
      
      const requiredFields = ['merchant_id', 'hash_key', 'hash_iv'];
      for (const field of requiredFields) {
        if (!config[field]) {
          return { success: false, error: `Missing ${field} in OPay configuration` };
        }
        if (this.isPlaceholder(config[field])) {
          return { success: false, error: `Invalid ${field} in OPay configuration: placeholder detected` };
        }
      }
      
      const { merchant_id, hash_key, hash_iv } = config;
      
      const opay_customer_data = { ...customerData };
      
      const timestamp = Math.floor(Date.now() / 1000);
      
      const json_data = JSON.stringify(opay_customer_data);
      const url_encoded = encodeURIComponent(json_data);

      const key_buffer = new TextEncoder().encode(hash_key.padEnd(16, '\0').substring(0, 16));
      const iv_buffer = new TextEncoder().encode(hash_iv.padEnd(16, '\0').substring(0, 16));
      const data_buffer = new TextEncoder().encode(url_encoded);

      const crypto_key = await crypto.subtle.importKey(
        'raw',
        key_buffer,
        { name: 'AES-CBC' },
        false,
        ['encrypt']
      );

      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-CBC', iv: iv_buffer },
        crypto_key,
        data_buffer
      );

      const encrypted_base64 = btoa(String.fromCharCode(...new Uint8Array(encrypted)));
      
      return {
        success: true,
        data: {
          MerchantID: merchant_id,
          RqHeader: {
            Timestamp: timestamp
          },
          Data: encrypted_base64
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  isPlaceholder(value) {
    if (!value || typeof value !== 'string') return true;
    return /^YOUR_|^XXX+$|^000+$|^\s*$/.test(value);
  }
}
