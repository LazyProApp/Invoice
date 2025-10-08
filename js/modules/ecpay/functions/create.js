/**
 * ECPay Create Function
 * ECPay invoice creation processing
 */

export class EcpayCreateFunction {
  constructor(platform) {
    this.platform = platform;
    this.crypto = platform.crypto;
  }

  async process(data) {
    try {
      const config = data.testMode ? 
        data.platform_config?.test : 
        data.platform_config?.production;

      if (!config) {
        return { success: false, error: `Missing ECPay ${data.testMode ? 'test' : 'production'} credentials` };
      }

      const encryptResult = await this.crypto.encrypt(data, config);
      if (!encryptResult.success) {
        return { success: false, error: `Encryption failed: ${encryptResult.error}` };
      }

      const apiResponse = await this.callAPI(encryptResult.data, data.testMode);

      let finalResult = apiResponse.response;
      
      
      if (apiResponse.response.TransCode === 1 && apiResponse.response.Data) {
        try {
          finalResult = await this.crypto.decrypt(
            apiResponse.response,
            config.hash_key,
            config.hash_iv
          );
        } catch (decryptError) {
          finalResult = apiResponse.response;
        }
      } else {
        finalResult = apiResponse.response;
      }

      return this.parseResponse(finalResult);
    } catch (error) {
      return { success: false, error: `ECPay 發票開立失敗: ${error.message}` };
    }
  }

  async callAPI(encryptedData, testMode) {
    const { fetchWithTimeout } = await import('../../../utils/fetch-utils.js');
    
    const response = await fetchWithTimeout('./api/kick.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: 'ecpay',
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
    if (response.TransCode !== undefined && response.TransCode !== 1) {
      return { success: false, error: response.TransMsg || 'ECPay API 錯誤' };
    }
    
    const data = response.Data || response;
    
    if (data.RtnCode !== undefined && data.RtnCode !== 1) {
      return { success: false, error: data.RtnMsg || '發票開立失敗' };
    }
    
    const invoiceNumber = data.InvoiceNo || data.InvoiceNumber || data.invoiceNumber;
    const randomNumber = data.RandomNumber || data.randomNumber;
    const createTime = data.InvoiceDate || data.createTime || new Date().toISOString();
    
    if (!invoiceNumber) {
    }
    
    return {
      success: true,
      invoiceNumber,
      randomNumber,
      createTime,
      platform: 'ecpay',
      rawData: data
    };
  }
}
