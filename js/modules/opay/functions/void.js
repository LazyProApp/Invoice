export class OpayVoidFunction {
  constructor(platform) {
    this.platform = platform;
    this.crypto = platform.crypto;
    this.validator = platform.validator;
    this.rules = platform.rules;
  }

  async process(data) {
    try {
      if (!data.invoiceNumber || !data.reason) {
        return { success: false, error: '缺少必要參數：invoiceNumber 和 reason' };
      }

      const config = data.testMode ? 
        data.platform_config.test : 
        data.platform_config.production;

      if (!config) {
        return { success: false, error: `缺少 OPay ${data.testMode ? '測試' : '正式'} 憑證` };
      }

      const encryptResult = await this.encryptVoidData(data, config);
      if (!encryptResult.success) {
        return { success: false, error: `加密失敗: ${encryptResult.error}` };
      }

      const apiResponse = await this.callAPI(encryptResult.data, data.testMode);

      return await this.parseResponse(apiResponse.response, config);
    } catch (error) {
      return { success: false, error: `OPay 發票作廢失敗: ${error.message}` };
    }
  }

  async encryptVoidData(data, config) {
    const isB2B = data.category === 'B2B';

    const invoiceDate = data.invoiceDate ?
      new Date(data.invoiceDate).toISOString().split('T')[0] :
      new Date().toISOString().split('T')[0];

    const voidData = {
      MerchantID: config.merchant_id,
      InvoiceDate: invoiceDate,
      Reason: data.reason,
      invoiceType: isB2B ? 'B2B' : 'B2C'
    };

    if (isB2B) {
      voidData.InvoiceNumber = data.invoiceNumber;
    } else {
      voidData.InvoiceNo = data.invoiceNumber;
    }
    
    const jsonStr = JSON.stringify(voidData);
    const encrypted = await this.opayAesEncrypt(jsonStr, config);
    
    return {
      success: true,
      data: {
        MerchantID: config.merchant_id,
        RqHeader: {
          Timestamp: Math.floor(Date.now() / 1000)
        },
        Data: encrypted,
        InvoiceType: voidData.invoiceType
      }
    };
  }

  async opayAesEncrypt(jsonData, config) {
    const urlEncoded = encodeURIComponent(jsonData);
    const keyBuffer = new TextEncoder().encode(
      config.hash_key.padEnd(16, '\0').substring(0, 16)
    );
    const ivBuffer = new TextEncoder().encode(
      config.hash_iv.padEnd(16, '\0').substring(0, 16)
    );
    const dataBuffer = new TextEncoder().encode(urlEncoded);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyBuffer, { name: 'AES-CBC' }, false, ['encrypt']
    );
    
    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: 'AES-CBC', iv: ivBuffer },
      cryptoKey,
      dataBuffer
    );
    
    return btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer)));
  }

  async callAPI(encryptedData, testMode) {
    const { fetchWithTimeout } = await import('../../../utils/fetch-utils.js');

    const requestData = {
      platform: 'opay',
      action: 'void',
      test_mode: testMode,
      invoice_type: encryptedData.InvoiceType,
      data: encryptedData
    };

    const response = await fetchWithTimeout('./api/kick.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestData)
    }, 10000);

    const result = await response.json();
    if (!result.success) {
      return { success: false, error: result.error || 'API 調用失敗' };
    }
    return result;
  }

  async parseResponse(response, config) {
    if (response.TransCode !== 1) {
      return {
        success: false,
        error: response.TransMsg || 'OPay API 呼叫失敗'
      };
    }

    if (!response.Data) {
      return {
        success: false,
        error: 'OPay 回應缺少 Data 欄位'
      };
    }

    try {
      const decryptedResponse = await this.crypto.decrypt(
        response,
        config.hash_key,
        config.hash_iv
      );

      if (decryptedResponse.Data && decryptedResponse.Data.RtnCode === 1) {
        return {
          success: true,
          voidTime: new Date().toISOString(),
          invoiceNumber: decryptedResponse.Data.InvoiceNo || decryptedResponse.Data.InvoiceNumber || '',
          message: decryptedResponse.Data.RtnMsg || '作廢成功'
        };
      } else {
        return {
          success: false,
          error: decryptedResponse.Data?.RtnMsg || 'OPay 作廢失敗'
        };
      }

    } catch (decryptError) {
      try {
        let voidData;
        if (typeof response.Data === 'string') {
          voidData = JSON.parse(response.Data);
        } else {
          voidData = response.Data;
        }

        if (voidData.RtnCode === 1) {
          return {
            success: true,
            voidTime: new Date().toISOString(),
            invoiceNumber: voidData.InvoiceNo || voidData.InvoiceNumber || '',
            message: voidData.RtnMsg || '作廢成功'
          };
        } else {
          return {
            success: false,
            error: voidData.RtnMsg || 'OPay 作廢失敗'
          };
        }
      } catch (parseError) {
        return {
          success: false,
          error: `OPay 回應解析失敗: ${decryptError.message}`
        };
      }
    }
  }
}