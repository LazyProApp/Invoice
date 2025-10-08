export class EzpayVoidFunction {
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
        return { success: false, error: `缺少 ezPay ${data.testMode ? '測試' : '正式'} 憑證` };
      }

      const encryptResult = await this.encryptVoidData(data, config);
      if (!encryptResult.success) {
        return { success: false, error: `加密失敗: ${encryptResult.error}` };
      }

      const apiResponse = await this.callAPI(encryptResult.data, data.testMode);
      
      return this.parseResponse(apiResponse.response);
    } catch (error) {
      return { success: false, error: `ezPay 發票作廢失敗: ${error.message}` };
    }
  }

  async encryptVoidData(data, config) {
    const voidData = {
      RespondType: 'JSON',
      Version: '1.0',
      TimeStamp: Math.floor(Date.now() / 1000),
      InvoiceNumber: data.invoiceNumber,
      InvalidReason: data.reason
    };

    try {
      const queryString = Object.keys(voidData)
        .map(key => `${key}=${encodeURIComponent(voidData[key])}`)
        .join('&');

      const encrypted = await this.crypto.aesEncrypt(
        queryString,
        config.hash_key,
        config.hash_iv
      );

      return {
        success: true,
        data: {
          MerchantID_: config.merchant_id,
          PostData_: encrypted
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async callAPI(encryptedData, testMode) {
    const { fetchWithTimeout } = await import('../../../utils/fetch-utils.js');
    
    const response = await fetchWithTimeout('./api/kick.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: 'ezpay',
        action: 'void',
        test_mode: testMode,
        data: encryptedData
      })
    }, 10000);

    const result = await response.json();
    if (!result.success) {
      return { success: false, error: result.error || 'API 調用失敗' };
    }
    return result;
  }

  parseResponse(response) {
    if (response.Status !== 'SUCCESS') {
      return {
        success: false,
        error: response.Message || 'ezPay 作廢發票失敗'
      };
    }

    let result = {};
    if (response.Result) {
      try {
        result = typeof response.Result === 'string'
          ? JSON.parse(response.Result)
          : response.Result;
      } catch (e) {
      }
    }

    return {
      success: true,
      voidTime: result.CreateTime || new Date().toISOString(),
      invoiceNumber: result.InvoiceNumber || '',
      message: '作廢成功'
    };
  }
}