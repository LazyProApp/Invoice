/**
 * Amego Create Function
 * Amego invoice creation processing
 */

export class AmegoCreateFunction {
  constructor(platform) {
    this.platform = platform;
    this.crypto = platform.crypto;
  }

  async process(data) {
    try {
      const config = data.testMode ? 
        data.platform_config.test : 
        data.platform_config.production;

      const encryptResult = await this.crypto.encrypt(data, config);
      if (!encryptResult.success) {
        return { success: false, error: `Encryption failed: ${encryptResult.error}` };
      }

      const apiResponse = await this.callAPI(encryptResult.data, data.testMode);
      
      return this.parseResponse(apiResponse.response);
    } catch (error) {
      return { success: false, error: `Amego 發票開立失敗: ${error.message}` };
    }
  }

  async callAPI(encryptedData, testMode) {
    const { fetchWithTimeout } = await import('../../../utils/fetch-utils.js');
    
    const response = await fetchWithTimeout('./api/kick.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: 'amego',
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
    let parsedData = response;
    
    if (typeof response === 'string') {
      try {
        parsedData = JSON.parse(response);
      } catch (e) {
        return { success: false, error: 'Invalid response format' };
      }
    }
    
    if (parsedData.code !== 0 && parsedData.status !== 'success') {
      return { success: false, error: parsedData.msg || parsedData.message || 'Amego 開立發票失敗' };
    }
    
    return {
      success: true,
      invoiceNumber: parsedData.invoice_number || parsedData.InvoiceNumber || parsedData.InvoiceNo || '',
      randomNumber: parsedData.random_num || parsedData.RandomNumber || parsedData.RandomNum || '',
      createTime: parsedData.create_time || parsedData.InvoiceDate || '',
      platform: 'amego'
    };
  }
}
