/**
 * SmilePay Create Function
 * SmilePay invoice creation processing
 */

export class SmilepayCreateFunction {
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
      return { success: false, error: `SmilePay 發票開立失敗: ${error.message}` };
    }
  }

  async callAPI(encryptedData, testMode) {
    const { fetchWithTimeout } = await import('../../../utils/fetch-utils.js');
    
    const response = await fetchWithTimeout('./api/kick.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: 'smilepay',
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
    
    if (typeof response === 'string' && response.startsWith('<?xml')) {
      parsedData = this.parseXML(response);
    }
    
    if (parsedData.Status !== '0' && parsedData.Status !== 0) {
      return { success: false, error: parsedData.Desc || 'SmilePay 開立發票失敗' };
    }
    
    return {
      success: true,
      invoiceNumber: parsedData.InvoiceNumber || parsedData.Inv_no || '',
      randomNumber: parsedData.RandomNumber || parsedData.Random_no || '',
      createTime: parsedData.InvoiceDate || '',
      platform: 'smilepay'
    };
  }

  parseXML(xmlString) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
    
    if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
      return { success: false, error: 'XML parsing error' };
    }
    
    const root = xmlDoc.getElementsByTagName('SmilePayEinvoice')[0] || xmlDoc.documentElement;
    const result = {};
    
    const fields = ['Status', 'Desc', 'InvoiceNumber', 'RandomNumber', 'InvoiceDate', 'Inv_no', 'Random_no'];
    fields.forEach(field => {
      const element = root.getElementsByTagName(field)[0];
      if (element) {
        result[field] = element.textContent;
      }
    });
    
    return result;
  }
}
