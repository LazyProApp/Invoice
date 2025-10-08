/**
 * SmilePay Crypto Module
 * SmilePay invoice encryption and signature processing
 */

export class SmilepayCrypto {
  async encrypt(data, config) {
    try {
      if (!config) return { success: false, error: 'Platform configuration is required' };
      
      const requiredFields = ['grvc', 'verify_key'];
      for (const field of requiredFields) {
        if (!config[field]) {
          return { success: false, error: `Missing ${field} in SmilePay configuration` };
        }
        if (this.isPlaceholder(config[field])) {
          return { success: false, error: `Invalid ${field} in SmilePay configuration: placeholder detected` };
        }
      }
      
      const { grvc, verify_key } = config;

      const smilePayData = this.transformToSmilePayFormat(data);
      const dcvc = await this.generateDCVC(smilePayData, verify_key);

      return {
        success: true,
        platform: 'smilepay',
        data: {
          Grvc: grvc,
          Verify_key: verify_key,
          ...smilePayData,
          Dcvc: dcvc
        }
      };
    } catch (error) {
      return { success: false, platform: 'smilepay', error: error.message };
    }
  }

  transformToSmilePayFormat(invoice) {
    const params = {};

    const now = new Date();
    params.InvoiceDate = now
      .toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      })
      .replace(/\//g, '/');
    params.InvoiceTime = now.toTimeString().slice(0, 8);

    const tax_type = invoice.tax_type || '1';
    params.Intype = this.mapTaxType(tax_type);
    params.TaxType = tax_type;
    if (invoice.category === 'B2B') {
      params.Buyer_id = invoice.buyer_ubn || '';
      params.CompanyName = invoice.buyer_name || '';
      params.DonateMark = '0';
      params.UnitTAX = 'Y';
    } else {
      if (invoice.buyer_name) {
        params.Name = invoice.buyer_name;
      }

      if (invoice.carrier_type === 'donate') {
        params.DonateMark = '1';
        params.LoveKey = invoice.carrier_num;
      } else if (invoice.carrier_type) {
        params.DonateMark = '0';
        params.CarrierType = invoice.carrier_type;

        if (invoice.carrier_type === 'EJ0113') {
          params.CarrierID = '';
          params.CarrierID2 = '';
        } else if (invoice.carrier_num) {
          params.CarrierID = invoice.carrier_num;
          if (invoice.carrier_id2) {
            params.CarrierID2 = invoice.carrier_id2;
          } else {
            params.CarrierID2 =
              'SMPAY_' + this.md5_simple(invoice.carrier_num).substring(0, 8);
          }
        }
      } else {
        params.DonateMark = '0';
      }
    }

    if (invoice.buyer_phone) params.Phone = invoice.buyer_phone;
    if (invoice.buyer_email) params.Email = invoice.buyer_email;
    if (invoice.buyer_address) params.Address = invoice.buyer_address;

    this.addItemsToParams(params, invoice.items, invoice);

    if (invoice.tax_type === '9') {
      params.SalesAmount = invoice.sales_amount || 0;
      params.FreeTaxSalesAmount = invoice.free_tax_sales_amount || 0;
    }

    if (invoice.tax_type === '2' && invoice.clearance_mark) {
      params.CustomsClearanceMark = invoice.clearance_mark;
    }

    if (invoice.merchant_order_no) {
      params.orderid = invoice.merchant_order_no;
    }

    return params;
  }

  mapTaxType(tax_type) {
    switch (tax_type) {
      case '4':
        return '08';
      case '9':
        return '07';
      case '1':
      case '2':
      case '3':
      default:
        return '07';
    }
  }

  addItemsToParams(params, items, data = {}) {
    const names = [],
      qtys = [],
      units = [],
      prices = [],
      amounts = [];

    let totalAmount = 0;

    items.forEach((item) => {
      const name = item.name || '';
      const qty = parseInt(item.count || 1);
      const unit = item.unit || '';
      const price = parseInt(item.price || 0);

      const taxRate = data.tax_type === '1' ? 1.05 :
                     data.tax_type === '4' ? (1 + (data.tax_rate || 5) / 100) : 1.0;

      const unitPrice = Math.round(price * taxRate);
      const amount = qty * unitPrice;

      names.push(name);
      qtys.push(qty);
      units.push(unit);
      prices.push(unitPrice);
      amounts.push(amount);

      totalAmount += amount;
    });

    params.Description = names.join('|');
    params.Quantity = qtys.join('|');
    params.Unit = units.join('|');
    params.UnitPrice = prices.join('|');
    params.Amount = amounts.join('|');

    params.AllAmount = totalAmount;
  }

  md5_simple(str) {
    return this.simpleHash(str);
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  async generateDCVC(data, verify_key) {
    try {
      const dataString = JSON.stringify(data);
      const verifyString = dataString + verify_key;
      const hashBuffer = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(verifyString)
      );
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      return hashHex.toUpperCase();
    } catch (error) {
      return { success: false, error: 'DCVC generation failed: ' + error.message };
    }
  }

  isPlaceholder(value) {
    if (!value || typeof value !== 'string') return true;
    return /^YOUR_|^XXX+$|^000+$|^\s*$/.test(value);
  }
}
