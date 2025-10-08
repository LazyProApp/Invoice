/**
 * Amego Crypto Module
 * Amego invoice encryption and signature processing
 */

export class AmegoCrypto {
  async encrypt(data, config) {
    try {
      if (!config) return { success: false, error: 'Platform configuration is required' };
      
      const requiredFields = ['ubn', 'app_key'];
      for (const field of requiredFields) {
        if (!config[field]) {
          return { success: false, error: `Missing ${field} in Amego configuration` };
        }
        if (this.isPlaceholder(config[field])) {
          return { success: false, error: `Invalid ${field} in Amego configuration: placeholder detected` };
        }
      }
      
      const { ubn, app_key } = config;

      const amegoData = this.transformToAmegoFormat(data);
      const timestamp = Math.floor(Date.now() / 1000);
      const jsonData = JSON.stringify(amegoData);
      const signature = await this.generateAmegoSignature(
        jsonData,
        timestamp,
        app_key
      );

      const formData = {
        invoice: ubn,
        data: jsonData,
        time: timestamp,
        sign: signature
      };

      return { success: true, platform: 'amego', data: formData };
    } catch (error) {
      return { success: false, platform: 'amego', error: error.message };
    }
  }

  transformToAmegoFormat(invoice) {
    const result = {};

    result.OrderId =
      invoice.merchant_order_no ||
      'AMEGO_' +
        new Date()
          .toISOString()
          .slice(0, 19)
          .replace(/[-:T]/g, '')
          .slice(0, 14) +
        '_' +
        Math.random().toString(36).slice(-4);

    if (invoice.category === 'B2B' && invoice.buyer_ubn) {
      result.BuyerIdentifier = invoice.buyer_ubn;
    } else {
      result.BuyerIdentifier = '0000000000';
    }

    result.BuyerName = invoice.buyer_name || '';

    if (invoice.buyer_address) {
      result.BuyerAddress = invoice.buyer_address;
    }
    if (invoice.buyer_email) {
      result.BuyerEmailAddress = invoice.buyer_email;
    }
    if (invoice.buyer_phone) {
      result.BuyerTelephoneNumber = invoice.buyer_phone;
    }

    const taxType = invoice.tax_type || '1';
    result.TaxType = parseInt(taxType);

    if (invoice.tax_rate && invoice.tax_rate != 5) {
      result.TaxRate = parseFloat(invoice.tax_rate) / 100;
    }

    if (invoice.clearance_mark) {
      result.CustomsClearanceMark = parseInt(invoice.clearance_mark);
    }

    if (taxType === '4') {
      result.TrackApiCode = 'OX';
    }

    if (taxType === '2') {
      if (!result.CustomsClearanceMark) {
        result.CustomsClearanceMark = 1;
      }
      result.ZeroTaxRateReason = 72;
      result.TaxRate = '0';
    }

    if (invoice.category !== 'B2B') {
      if (invoice.carrier_type) {
        if (invoice.carrier_type === 'donate') {
          result.NPOBAN = invoice.carrier_num;
        } else {
          result.CarrierType = invoice.carrier_type;
          if (invoice.carrier_num) {
            result.CarrierId1 = invoice.carrier_num;
            result.CarrierId2 = invoice.carrier_num2 || invoice.carrier_num;
          }
        }
      }
    }

    result.ProductItem = this.transformItems(invoice.items, taxType, invoice, invoice.category, invoice.buyer_ubn);

    const amounts = this.calculateAmounts(
      0,
      taxType,
      invoice.category,
      invoice.buyer_ubn,
      invoice
    );
    Object.assign(result, amounts);

    result.TotalAmount = Math.round(invoice.total_amt || 0);

    if (taxType === '1') {
      result.TaxRate = '0.05';
    } else if (taxType === '3') {
      result.TaxRate = '0';
    } else if (taxType === '4' && invoice.tax_rate) {
      result.TaxRate = (parseFloat(invoice.tax_rate) / 100).toString();
    }

    if (invoice.comment) {
      result.MainRemark = invoice.comment;
    }

    if (invoice.invoice_date) {
      result.InvoiceDate = new Date(invoice.invoice_date)
        .toLocaleDateString('zh-TW', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        })
        .replace(/\//g, '/');
    }

    result.DetailVat = (invoice.category === 'B2B' && invoice.buyer_ubn) ? 0 : 1;

    return result;
  }


  calculateAmounts(totalAmount, taxType, category, buyerUbn, invoice) {
    const amounts = {};

    switch (taxType) {
      case '2':
        amounts.SalesAmount = 0;
        amounts.FreeTaxSalesAmount = 0;
        amounts.ZeroTaxSalesAmount = Math.round(invoice.total_amt || 0);
        amounts.TaxAmount = 0;
        break;

      case '3':
        amounts.SalesAmount = 0;
        amounts.FreeTaxSalesAmount = Math.round(invoice.total_amt || 0);
        amounts.ZeroTaxSalesAmount = 0;
        amounts.TaxAmount = 0;
        break;

      case '4':
        amounts.SalesAmount = Math.round(invoice.amt || 0);
        amounts.TaxAmount = Math.round(invoice.tax_amt || 0);
        amounts.FreeTaxSalesAmount = 0;
        amounts.ZeroTaxSalesAmount = 0;
        break;

      default:
        if (category === 'B2B' && buyerUbn) {
          amounts.SalesAmount = Math.round(invoice.amt || 0);
          amounts.TaxAmount = Math.round(invoice.tax_amt || 0);
        } else {
          amounts.SalesAmount = Math.round(invoice.total_amt || 0);
          amounts.TaxAmount = 0;
        }
        amounts.FreeTaxSalesAmount = 0;
        amounts.ZeroTaxSalesAmount = 0;
        break;
    }

    return amounts;
  }

  transformItems(items, mainTaxType, invoice, category, buyerUbn) {
    const details = [];
    const isB2B = category === 'B2B' && buyerUbn;
    const isB2CTaxable = !isB2B && mainTaxType === '1';

    const totalAmt = invoice.total_amt || 0;
    const salesAmt = invoice.amt || 0;

    items.forEach((item) => {
      let unitPrice = item.price || 0;
      let amount = item.amt || (unitPrice * (item.count || 1));

      if (isB2CTaxable) {
        if (items.length === 1) {
          amount = totalAmt;
        } else {
          amount = Math.round((item.amt / salesAmt) * totalAmt);
        }
        unitPrice = amount / (item.count || 1);
      }

      const detail = {
        Description: item.name || '',
        Quantity: parseInt(item.count || 1),
        Unit: item.unit || '',
        UnitPrice: parseFloat(unitPrice),
        Amount: parseFloat(amount),
        TaxType: parseInt(mainTaxType)
      };

      details.push(detail);
    });

    return details;
  }

  async generateAmegoSignature(jsonStr, timestamp, appKey) {
    try {
      const timeStr = timestamp.toString();
      const signString = jsonStr + timeStr + appKey;


      const signature = await this.md5_reliable(signString);

      return signature;
    } catch (error) {
      return { success: false, error: 'Amego signature generation failed: ' + error.message };
    }
  }

  async md5_reliable(str) {
    return this.md5_correct(str);
  }

  md5_correct(str) {
    const hex = (c) =>
      c.toString(16).padStart(8, '0').match(/../g).reverse().join('');
    const rol = (n, b) => (n << b) | (n >>> (32 - b));
    const add = (x, y) => (x + y) >>> 0;

    const k = Array.from({ length: 64 }, (_, i) =>
      Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000)
    );
    const r = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
    const [a0, b0, c0, d0] = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476];

    const utf8Bytes = new TextEncoder().encode(str);
    const len = utf8Bytes.length;
    const bitLen = len * 8;
    const bytes = Array.from(utf8Bytes);
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    bytes.push(
      bitLen & 0xff,
      (bitLen >>> 8) & 0xff,
      (bitLen >>> 16) & 0xff,
      (bitLen >>> 24) & 0xff,
      0,
      0,
      0,
      0
    );

    let [A, B, C, D] = [a0, b0, c0, d0];
    for (let offset = 0; offset < bytes.length; offset += 64) {
      const X = [];
      for (let i = 0; i < 64; i += 4) {
        X.push(
          bytes[offset + i] |
            (bytes[offset + i + 1] << 8) |
            (bytes[offset + i + 2] << 16) |
            (bytes[offset + i + 3] << 24)
        );
      }

      let [a, b, c, d] = [A, B, C, D];
      for (let i = 0; i < 64; i++) {
        let f, g;
        if (i < 16) {
          f = (b & c) | (~b & d);
          g = i;
        } else if (i < 32) {
          f = (d & b) | (~d & c);
          g = (5 * i + 1) % 16;
        } else if (i < 48) {
          f = b ^ c ^ d;
          g = (3 * i + 5) % 16;
        } else {
          f = c ^ (b | ~d);
          g = (7 * i) % 16;
        }

        const temp = add(add(add(a, f), add(k[i], X[g])), 0);
        a = d;
        d = c;
        c = b;
        b = add(b, rol(temp, r[((i >>> 2) & 12) | (i & 3)]));
      }
      [A, B, C, D] = [add(A, a), add(B, b), add(C, c), add(D, d)];
    }

    return hex(A) + hex(B) + hex(C) + hex(D);
  }

  md5(str) {
    function rotateLeft(n, s) {
      return (n << s) | (n >>> (32 - s));
    }

    function addUnsigned(x, y) {
      const x4 = x & 0x40000000;
      const y4 = y & 0x40000000;
      const x8 = x & 0x80000000;
      const y8 = y & 0x80000000;
      const result = (x & 0x3fffffff) + (y & 0x3fffffff);
      if (x4 & y4) {
        return result ^ 0x80000000 ^ x8 ^ y8;
      }
      if (x4 | y4) {
        if (result & 0x40000000) {
          return result ^ 0xc0000000 ^ x8 ^ y8;
        } else {
          return result ^ 0x40000000 ^ x8 ^ y8;
        }
      } else {
        return result ^ x8 ^ y8;
      }
    }

    function f(x, y, z) {
      return (x & y) | (~x & z);
    }
    function g(x, y, z) {
      return (x & z) | (y & ~z);
    }
    function h(x, y, z) {
      return x ^ y ^ z;
    }
    function i(x, y, z) {
      return y ^ (x | ~z);
    }

    function ff(a, b, c, d, x, s, ac) {
      a = addUnsigned(a, addUnsigned(addUnsigned(f(b, c, d), x), ac));
      return addUnsigned(rotateLeft(a, s), b);
    }

    function gg(a, b, c, d, x, s, ac) {
      a = addUnsigned(a, addUnsigned(addUnsigned(g(b, c, d), x), ac));
      return addUnsigned(rotateLeft(a, s), b);
    }

    function hh(a, b, c, d, x, s, ac) {
      a = addUnsigned(a, addUnsigned(addUnsigned(h(b, c, d), x), ac));
      return addUnsigned(rotateLeft(a, s), b);
    }

    function ii(a, b, c, d, x, s, ac) {
      a = addUnsigned(a, addUnsigned(addUnsigned(i(b, c, d), x), ac));
      return addUnsigned(rotateLeft(a, s), b);
    }

    function convertToWordArray(str) {
      const wordArray = [];
      const strLen = str.length;
      const totalBits = strLen * 8;

      for (let i = 0; i < strLen; i++) {
        const wordIndex = Math.floor(i / 4);
        const byteIndex = (i % 4) * 8;
        wordArray[wordIndex] =
          (wordArray[wordIndex] || 0) | (str.charCodeAt(i) << byteIndex);
      }

      const padding = 64 - (totalBits % 64);
      const paddingBits = padding === 64 ? 0 : padding;
      const paddingBytes = Math.floor(paddingBits / 8);

      if (paddingBytes > 0) {
        const wordIndex = Math.floor(strLen / 4);
        const byteIndex = (strLen % 4) * 8;
        wordArray[wordIndex] =
          (wordArray[wordIndex] || 0) | (0x80 << byteIndex);
      }

      const totalWords = Math.ceil((strLen + paddingBytes + 8) / 4);
      for (let i = wordArray.length; i < totalWords; i++) {
        wordArray[i] = 0;
      }

      wordArray[totalWords - 2] = totalBits & 0xffffffff;
      wordArray[totalWords - 1] = Math.floor(totalBits / 0x100000000);

      return wordArray;
    }

    function wordToHex(word) {
      let hex = '';
      for (let i = 0; i < 4; i++) {
        const byte = (word >>> (i * 8)) & 0xff;
        hex += ('0' + byte.toString(16)).slice(-2);
      }
      return hex;
    }

    const x = convertToWordArray(str);
    let a = 0x67452301;
    let b = 0xefcdab89;
    let c = 0x98badcfe;
    let d = 0x10325476;

    for (let k = 0; k < x.length; k += 16) {
      const AA = a;
      const BB = b;
      const CC = c;
      const DD = d;

      a = ff(a, b, c, d, x[k + 0], 7, 0xd76aa478);
      d = ff(d, a, b, c, x[k + 1], 12, 0xe8c7b756);
      c = ff(c, d, a, b, x[k + 2], 17, 0x242070db);
      b = ff(b, c, d, a, x[k + 3], 22, 0xc1bdceee);
      a = ff(a, b, c, d, x[k + 4], 7, 0xf57c0faf);
      d = ff(d, a, b, c, x[k + 5], 12, 0x4787c62a);
      c = ff(c, d, a, b, x[k + 6], 17, 0xa8304613);
      b = ff(b, c, d, a, x[k + 7], 22, 0xfd469501);
      a = ff(a, b, c, d, x[k + 8], 7, 0x698098d8);
      d = ff(d, a, b, c, x[k + 9], 12, 0x8b44f7af);
      c = ff(c, d, a, b, x[k + 10], 17, 0xffff5bb1);
      b = ff(b, c, d, a, x[k + 11], 22, 0x895cd7be);
      a = ff(a, b, c, d, x[k + 12], 7, 0x6b901122);
      d = ff(d, a, b, c, x[k + 13], 12, 0xfd987193);
      c = ff(c, d, a, b, x[k + 14], 17, 0xa679438e);
      b = ff(b, c, d, a, x[k + 15], 22, 0x49b40821);

      a = gg(a, b, c, d, x[k + 1], 5, 0xf61e2562);
      d = gg(d, a, b, c, x[k + 6], 9, 0xc040b340);
      c = gg(c, d, a, b, x[k + 11], 14, 0x265e5a51);
      b = gg(b, c, d, a, x[k + 0], 20, 0xe9b6c7aa);
      a = gg(a, b, c, d, x[k + 5], 5, 0xd62f105d);
      d = gg(d, a, b, c, x[k + 10], 9, 0x2441453);
      c = gg(c, d, a, b, x[k + 15], 14, 0xd8a1e681);
      b = gg(b, c, d, a, x[k + 4], 20, 0xe7d3fbc8);
      a = gg(a, b, c, d, x[k + 9], 5, 0x21e1cde6);
      d = gg(d, a, b, c, x[k + 14], 9, 0xc33707d6);
      c = gg(c, d, a, b, x[k + 3], 14, 0xf4d50d87);
      b = gg(b, c, d, a, x[k + 8], 20, 0x455a14ed);
      a = gg(a, b, c, d, x[k + 13], 5, 0xa9e3e905);
      d = gg(d, a, b, c, x[k + 2], 9, 0xfcefa3f8);
      c = gg(c, d, a, b, x[k + 7], 14, 0x676f02d9);
      b = gg(b, c, d, a, x[k + 12], 20, 0x8d2a4c8a);

      a = hh(a, b, c, d, x[k + 5], 4, 0xfffa3942);
      d = hh(d, a, b, c, x[k + 8], 11, 0x8771f681);
      c = hh(c, d, a, b, x[k + 11], 16, 0x6d9d6122);
      b = hh(b, c, d, a, x[k + 14], 23, 0xfde5380c);
      a = hh(a, b, c, d, x[k + 1], 4, 0xa4beea44);
      d = hh(d, a, b, c, x[k + 4], 11, 0x4bdecfa9);
      c = hh(c, d, a, b, x[k + 7], 16, 0xf6bb4b60);
      b = hh(b, c, d, a, x[k + 10], 23, 0xbebfbc70);
      a = hh(a, b, c, d, x[k + 13], 4, 0x289b7ec6);
      d = hh(d, a, b, c, x[k + 0], 11, 0xeaa127fa);
      c = hh(c, d, a, b, x[k + 3], 16, 0xd4ef3085);
      b = hh(b, c, d, a, x[k + 6], 23, 0x4881d05);
      a = hh(a, b, c, d, x[k + 9], 4, 0xd9d4d039);
      d = hh(d, a, b, c, x[k + 12], 11, 0xe6db99e5);
      c = hh(c, d, a, b, x[k + 15], 16, 0x1fa27cf8);
      b = hh(b, c, d, a, x[k + 2], 23, 0xc4ac5665);

      a = ii(a, b, c, d, x[k + 0], 6, 0xf4292244);
      d = ii(d, a, b, c, x[k + 7], 10, 0x432aff97);
      c = ii(c, d, a, b, x[k + 14], 15, 0xab9423a7);
      b = ii(b, c, d, a, x[k + 5], 21, 0xfc93a039);
      a = ii(a, b, c, d, x[k + 12], 6, 0x655b59c3);
      d = ii(d, a, b, c, x[k + 3], 10, 0x8f0ccc92);
      c = ii(c, d, a, b, x[k + 10], 15, 0xffeff47d);
      b = ii(b, c, d, a, x[k + 1], 21, 0x85845dd1);
      a = ii(a, b, c, d, x[k + 8], 6, 0x6fa87e4f);
      d = ii(d, a, b, c, x[k + 15], 10, 0xfe2ce6e0);
      c = ii(c, d, a, b, x[k + 6], 15, 0xa3014314);
      b = ii(b, c, d, a, x[k + 13], 21, 0x4e0811a1);
      a = ii(a, b, c, d, x[k + 4], 6, 0xf7537e82);
      d = ii(d, a, b, c, x[k + 11], 10, 0xbd3af235);
      c = ii(c, d, a, b, x[k + 2], 15, 0x2ad7d2bb);
      b = ii(b, c, d, a, x[k + 9], 21, 0xeb86d391);

      a = addUnsigned(a, AA);
      b = addUnsigned(b, BB);
      c = addUnsigned(c, CC);
      d = addUnsigned(d, DD);
    }

    return wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d);
  }

  async decrypt(responseData) {
    try {
      if (typeof responseData === 'string') {
        return JSON.parse(responseData);
      }

      return responseData;
    } catch (error) {
      return { success: false, error: 'Amego decryption failed: ' + error.message };
    }
  }

  jsonStringifyUnescaped(obj) {
    return JSON.stringify(obj).replace(/\\u[\dA-F]{4}/gi, function (match) {
      return String.fromCharCode(parseInt(match.replace(/\\u/g, ''), 16));
    });
  }

  isPlaceholder(value) {
    if (!value || typeof value !== 'string') return true;
    return /^YOUR_|^XXX+$|^000+$|^\s*$/.test(value);
  }
}
