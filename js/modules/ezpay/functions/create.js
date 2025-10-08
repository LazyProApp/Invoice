/**
 * EzPay Create Function
 * EzPay invoice creation processing
 */

export class EzpayCreateFunction {
  constructor(platform) {
    this.platform = platform;
    this.crypto = platform.crypto;
  }

  async process(data) {
    try {
      const config = data.testMode ? 
        data.platform_config.test : 
        data.platform_config.production;

      if (!config) {
        return { success: false, error: `Missing EzPay ${data.testMode ? 'test' : 'production'} credentials` };
      }

      const encryptResult = await this.crypto.encrypt(data, config);
      if (!encryptResult.success) {
        return { success: false, error: `Encryption failed: ${encryptResult.error}` };
      }

      const apiResponse = await this.callAPI(encryptResult.data, data.testMode);
      
      return this.parseResponse(apiResponse.response);
    } catch (error) {
      return { success: false, error: `ezPay 發票開立失敗: ${error.message}` };
    }
  }

  async callAPI(encryptedData, testMode) {
    const { fetchWithTimeout } = await import('../../../utils/fetch-utils.js');
    
    const response = await fetchWithTimeout('./api/kick.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: 'ezpay',
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
      return { success: false, error: response.Message || 'ezPay 開立發票失敗' };
    }
    
    let invoiceData = {};
    if (response.Result && typeof response.Result === 'string') {
      try {
        invoiceData = JSON.parse(response.Result);
      } catch (e) {
        invoiceData = {};
      }
    }
    
    return {
      success: true,
      invoiceNumber: invoiceData.InvoiceNumber || '',
      randomNumber: invoiceData.RandomNum || '',
      createTime: invoiceData.CreateTime || '',
      platform: 'ezpay'
    };
  }
}
