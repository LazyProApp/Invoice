export class AmegoVoidFunction {
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
        return { success: false, error: `缺少 Amego ${data.testMode ? '測試' : '正式'} 憑證` };
      }

      const voidData = await this.formatVoidData(data, config);
      const apiResponse = await this.callAPI(voidData, data.testMode);
      
      return this.parseResponse(apiResponse.response);
    } catch (error) {
      return { success: false, error: `Amego 發票作廢失敗: ${error.message}` };
    }
  }

  async formatVoidData(data, config) {
    const timestamp = Math.floor(Date.now() / 1000);
    const voidData = {
      CancelInvoiceNumber: data.invoiceNumber,
      CancelReason: data.reason
    };
    
    const voidArray = [voidData];
    const jsonStr = JSON.stringify(voidArray);
    
    const signature = await this.crypto.generateAmegoSignature(
      jsonStr, 
      timestamp, 
      config.app_key
    );
    
    return {
      invoice: config.ubn,
      data: jsonStr,
      time: timestamp,
      sign: signature
    };
  }

  async callAPI(voidData, testMode) {
    const { fetchWithTimeout } = await import('../../../utils/fetch-utils.js');
    
    const response = await fetchWithTimeout('./api/kick.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: 'amego',
        action: 'void',
        test_mode: testMode,
        data: voidData
      })
    }, 10000);

    const result = await response.json();
    if (!result.success) {
      return { success: false, error: result.error || 'API 調用失敗' };
    }
    return result;
  }

  parseResponse(response) {
    if (response && response.code === 0) {
      return {
        success: true,
        voidTime: new Date().toISOString(),
        invoiceNumber: response.invoice_number || '',
        message: '作廢成功'
      };
    }

    return {
      success: false,
      error: response?.msg || 'Amego 作廢發票失敗'
    };
  }
}