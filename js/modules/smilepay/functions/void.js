export class SmilepayVoidFunction {
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
        return { success: false, error: `缺少 SmilePay ${data.testMode ? '測試' : '正式'} 憑證` };
      }

      const voidData = this.formatVoidData(data, config);
      const apiResponse = await this.callAPI(voidData, data.testMode);
      
      return this.parseResponse(apiResponse.response);
    } catch (error) {
      return { success: false, error: `SmilePay 發票作廢失敗: ${error.message}` };
    }
  }

  formatVoidData(data, config) {
    const invoiceDate = data.invoiceDate ?
      data.invoiceDate.replace(/-/g, '/') :
      new Date().toISOString().split('T')[0].replace(/-/g, '/');

    const voidParams = {
      Grvc: config.grvc,
      Verify_key: config.verify_key,
      InvoiceNumber: data.invoiceNumber,
      InvoiceDate: invoiceDate,
      types: 'Cancel',
      CancelReason: data.reason
    };
    
    return Object.keys(voidParams)
      .map(key => `${key}=${encodeURIComponent(voidParams[key])}`)
      .join('&');
  }

  async callAPI(voidData, testMode) {
    const { fetchWithTimeout } = await import('../../../utils/fetch-utils.js');
    
    const response = await fetchWithTimeout('./api/kick.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: 'smilepay',
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
    let xmlContent = response.response || response;

    if (xmlContent.includes('<Status>0</Status>')) {
      const invoiceMatch = xmlContent.match(/<InvoiceNumber>([^<]+)<\/InvoiceNumber>/);
      const cancelTimeMatch = xmlContent.match(/<CancelTime>([^<]+)<\/CancelTime>/);

      return {
        success: true,
        voidTime: cancelTimeMatch ? cancelTimeMatch[1] : new Date().toISOString(),
        invoiceNumber: invoiceMatch ? invoiceMatch[1] : '',
        message: '作廢成功'
      };
    }

    const descMatch = xmlContent.match(/<Desc>([^<]*)<\/Desc>/);
    const statusMatch = xmlContent.match(/<Status>([^<]+)<\/Status>/);

    return {
      success: false,
      error: descMatch ? descMatch[1] || `SmilePay 作廢失敗 (代碼: ${statusMatch ? statusMatch[1] : 'unknown'})` : 'SmilePay 作廢發票失敗'
    };
  }
}