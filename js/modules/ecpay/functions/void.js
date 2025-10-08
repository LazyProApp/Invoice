export class EcpayVoidFunction {
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
        return { success: false, error: `缺少 ECPay ${data.testMode ? '測試' : '正式'} 憑證` };
      }

      const encryptResult = await this.encryptVoidData(data, config);
      if (!encryptResult.success) {
        return { success: false, error: `加密失敗: ${encryptResult.error}` };
      }

      const apiResponse = await this.callAPI(encryptResult.data, data.testMode, 'B2C');

      return await this.parseResponse(apiResponse.response, config);
    } catch (error) {
      return { success: false, error: `ECPay 發票作廢失敗: ${error.message}` };
    }
  }

  async encryptVoidData(data, config) {
    const invoiceDate = data.invoiceDate || new Date().toISOString().split('T')[0];

    const voidData = {
      MerchantID: config.merchant_id,
      InvoiceNo: data.invoiceNumber,
      InvoiceDate: invoiceDate,
      Reason: data.reason
    };
    
    const jsonStr = JSON.stringify(voidData);
    const urlEncoded = encodeURIComponent(jsonStr);
    const encrypted = await this.crypto.aesEncrypt(
      urlEncoded,
      config.hash_key,
      config.hash_iv
    );
    
    return {
      success: true,
      data: {
        MerchantID: config.merchant_id,
        RqHeader: {
          Timestamp: Math.floor(Date.now() / 1000)
        },
        Data: encrypted
      }
    };
  }

  async callAPI(encryptedData, testMode, invoiceType = 'B2C') {
    const { fetchWithTimeout } = await import('../../../utils/fetch-utils.js');

    const response = await fetchWithTimeout('./api/kick.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: 'ecpay',
        action: 'void',
        test_mode: testMode,
        invoice_type: invoiceType,
        data: encryptedData
      })
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
        error: response.TransMsg || 'ECPay API 呼叫失敗'
      };
    }

    if (!response.Data) {
      return {
        success: false,
        error: 'ECPay 回應缺少 Data 欄位'
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
          error: decryptedResponse.Data?.RtnMsg || 'ECPay 作廢失敗'
        };
      }

    } catch (decryptError) {
      return {
        success: false,
        error: `ECPay 回應解密失敗: ${decryptError.message}`
      };
    }
  }
}