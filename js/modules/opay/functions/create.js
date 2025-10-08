/**
 * OPay Create Function
 * OPay invoice creation processing
 */

export class OpayCreateFunction {
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
        return { success: false, error: `Missing OPay ${data.testMode ? 'test' : 'production'} credentials` };
      }

      const isB2B = data.buyer_ubn && data.buyer_ubn.trim() !== '';
      
      if (isB2B) {
        await this.maintainCustomerData(data, config);
      }
      
      const encryptResult = await this.crypto.encrypt(data, config);
      if (!encryptResult.success) {
        return { success: false, error: `Encryption failed: ${encryptResult.error}` };
      }

      const apiResponse = await this.callAPI(encryptResult.data, data.testMode, data);
      
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
      return { success: false, error: `OPay invoice creation failed: ${error.message}` };
    }
  }

  async callAPI(encryptedData, testMode, invoiceData = null) {
    const { fetchWithTimeout } = await import('../../../utils/fetch-utils.js');
    
    let invoiceType = 'B2C';
    if (invoiceData && invoiceData.buyer_ubn) {
      invoiceType = 'B2B';
    }
    
    const response = await fetchWithTimeout('./api/kick.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: 'opay',
        test_mode: testMode,
        invoice_type: invoiceType,
        data: encryptedData
      })
    }, 10000);

    const result = await response.json();
    if (!result.success) {
      return { success: false, error: result.error || 'API call failed' };
    }
    return result;
  }

  parseResponse(response) {
    if (response.TransCode !== undefined && response.TransCode !== 1) {
      return { success: false, error: response.TransMsg || 'OPay API error' };
    }
    
    const data = response.Data || response;
    
    if (data.RtnCode !== undefined && data.RtnCode !== 1) {
      return { success: false, error: data.RtnMsg || 'Invoice creation failed' };
    }
    
    const invoiceNumber = data.InvoiceNumber || data.InvoiceNo || data.invoiceNumber;
    const randomNumber = data.RandomNumber || data.randomNumber;
    const createTime = data.InvoiceDate || data.createTime || new Date().toISOString();
    
    return {
      success: true,
      data: {
        invoice_number: invoiceNumber,
        random_number: randomNumber,
        invoice_date: createTime,
        platform: 'opay'
      },
      invoiceNumber: invoiceNumber || 'OPAY-SUCCESS',
      randomNumber: randomNumber || '0000',
      createTime,
      platform: 'opay',
      rawData: data
    };
  }

  async maintainCustomerData(data, config) {
    const updateResult = await this.performCustomerMaintenance(data, config, 'Update');
    
    if (updateResult.success) {
      return true;
    }
    
    if (updateResult.errorCode === 6160050) {
      const addResult = await this.performCustomerMaintenance(data, config, 'Add');
      
      if (addResult.success) {
        return true;
      }
      
      if (addResult.errorCode === 6160052) {
        return true;
      }
      
      return { success: false, error: `Customer ADD failed: ${addResult.error}` };
    }
    
    return { success: false, error: `Customer UPDATE failed: ${updateResult.error}` };
  }

  async performCustomerMaintenance(data, config, action) {
    try {
      const customerData = {
        MerchantID: config.merchant_id,
        Action: action,
        Identifier: data.buyer_ubn,
        type: '1',
        CompanyName: data.buyer_name,
        TradingSlang: '123',
        ExchangeMode: '0',
        EmailAddress: data.buyer_email || ''
      };

      if (data.buyer_phone) {
        customerData.TelephoneNumber = data.buyer_phone;
      }
      if (data.buyer_address) {
        customerData.Address = data.buyer_address;
      }

      const encryptResult = await this.crypto.encryptCustomerData(customerData, config);
      if (!encryptResult.success) {
        return { success: false, error: `Customer data encryption failed: ${encryptResult.error}` };
      }

      const apiResponse = await this.callCustomerAPI(encryptResult.data, data.testMode);
      
      if (!apiResponse.success) {
        return { success: false, error: `Customer ${action} API failed: ${apiResponse.error}` };
      }

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
      }

        if (finalResult.TransCode !== undefined && finalResult.TransCode !== 1) {
        return {
          success: false,
          error: finalResult.TransMsg || 'OPay 客戶維護 API 錯誤'
        };
      }

      const customerResult = finalResult.Data || finalResult;
      if (customerResult.RtnCode !== undefined && customerResult.RtnCode !== 1) {
        return {
          success: false,
          errorCode: customerResult.RtnCode,
          error: customerResult.RtnMsg || '客戶維護失敗'
        };
      }

      return { success: true, message: customerResult.RtnMsg || '客戶維護成功' };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async callCustomerAPI(encryptedData, testMode) {
    const { fetchWithTimeout } = await import('../../../utils/fetch-utils.js');
    
    const response = await fetchWithTimeout('./api/kick.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: 'opay',
        test_mode: testMode,
        invoice_type: 'B2B',
        action: 'maintain_customer',
        data: encryptedData
      })
    }, 10000);

    const result = await response.json();
    if (!result.success) {
      return { success: false, error: result.error || '客戶建立 API 調用失敗' };
    }
    return result;
  }
}
