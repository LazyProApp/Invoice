# AI 發票資料轉換指南

將訂單資料轉換為 Lazy Invoice JSON 格式

## 📋 ECPay 範本

```jsonc
{
  "provider": "ecpay",  // 平台代碼，固定值
  "production": {  // 正式環境憑證
    "merchant_id": "YOUR_MERCHANT_ID",
    "hash_key": "YOUR_HASH_KEY",
    "hash_iv": "YOUR_HASH_IV"
  },
  "test": {  // 測試環境憑證
    "merchant_id": "YOUR_MERCHANT_ID",
    "hash_key": "YOUR_HASH_KEY",
    "hash_iv": "YOUR_HASH_IV"
  },
  "invoices": [
    {
      "merchant_order_no": "ORDER20250101001",  // 商家訂單編號
      "category": "B2B",  // 發票類別：B2B=公司, B2C=個人
      "buyer_name": "黑閃實驗室",  // 公司或買受人姓名
      "buyer_ubn": "93067949",  // 統一編號（8位數字）
      "buyer_address": "台北市信義區市府路45號89樓",  // 公司或買受人地址
      "buyer_email": "u@blackflash.network",  // Email
      "buyer_phone": "02-8101-2345",  // 電話
      "print_flag": "Y",  // 列印旗標：Y=列印, N=不列印
      "tax_type": "1",  // 課稅類別（參考下方對照表）
      "tax_rate": 5,  // 稅率（%）
      "amt": 10000,  // 未稅金額
      "tax_amt": 500,  // 稅額
      "total_amt": 10500,  // 含稅總額
      "items": [  // 發票品項
        {
          "name": "軟體授權",  // 品項名稱
          "count": 1,  // 數量
          "unit": "套",  // 單位
          "price": 10000,  // 單價
          "amt": 10000  // 小計
        }
      ]
    },
    {
      "merchant_order_no": "ORDER20250101002",  // 商家訂單編號
      "category": "B2C",  // 發票類別：B2B=公司, B2C=個人
      "buyer_name": "王小明",  // 買受人姓名
      "buyer_email": "wang@example.com",  // Email
      "buyer_phone": "0912-345-678",  // 電話
      "carrier_type": "3",  // 載具類型（參考下方對照表）
      "carrier_num": "/ABC1234",  // 載具號碼
      "print_flag": "N",  // 列印旗標：Y=列印, N=不列印
      "tax_type": "1",  // 課稅類別（參考下方對照表）
      "amt": 1300,  // 未稅金額
      "tax_amt": 65,  // 稅額
      "total_amt": 1365,  // 含稅總額
      "items": [  // 發票品項
        {
          "name": "書籍",  // 品項名稱
          "count": 2,  // 數量
          "unit": "本",  // 單位
          "price": 650,  // 單價
          "amt": 1300  // 小計
        }
      ]
    }
  ]
}
```

### ECPay 載具類型 (carrier_type)
| 代碼 | 說明 | 號碼格式 |
|------|------|----------|
| 1 | 綠界載具 | Email 或會員帳號 |
| 2 | 自然人憑證 | 2英文+14數字 |
| 3 | 手機條碼 | /+7碼 |
| 4 | 悠遊卡 | 16位數字 |
| 5 | 一卡通 | 16位數字 |
| donate | 愛心碼捐贈 | 3-7位數字（donation=1, love_code=號碼）|

### ECPay 稅率類型 (tax_type)
| 代碼 | 說明 | tax_rate |
|------|------|----------|
| 1 | 應稅 | 5 |
| 2 | 零稅率 | 0 |
| 3 | 免稅 | 0 |
| 9 | 混合稅率 | 各項目分別設定 |

---

## 📋 ezPay 範本

```jsonc
{
  "provider": "ezpay",  // 平台代碼，固定值
  "production": {  // 正式環境憑證
    "merchant_id": "YOUR_MERCHANT_ID",
    "hash_key": "YOUR_HASH_KEY",
    "hash_iv": "YOUR_HASH_IV"
  },
  "test": {  // 測試環境憑證
    "merchant_id": "YOUR_MERCHANT_ID",
    "hash_key": "YOUR_HASH_KEY",
    "hash_iv": "YOUR_HASH_IV"
  },
  "invoices": [
    {
      "merchant_order_no": "ORDER20250101001",  // 商家訂單編號
      "category": "B2B",  // 發票類別：B2B=公司, B2C=個人
      "buyer_name": "黑閃實驗室",  // 公司或買受人姓名
      "buyer_ubn": "93067949",  // 統一編號（8位數字）
      "buyer_address": "台北市信義區市府路45號89樓",  // 公司或買受人地址
      "buyer_email": "u@blackflash.network",  // Email
      "buyer_phone": "02-8101-2345",  // 電話
      "print_flag": "Y",  // 列印旗標：Y=列印, N=不列印
      "tax_type": "1",  // 課稅類別（參考下方對照表）
      "tax_rate": 5,  // 稅率（%）
      "amt": 10000,  // 未稅金額
      "tax_amt": 500,  // 稅額
      "total_amt": 10500,  // 含稅總額
      "items": [  // 發票品項
        {
          "name": "軟體授權",  // 品項名稱
          "count": 1,  // 數量
          "unit": "套",  // 單位
          "price": 10000,  // 單價
          "amt": 10000  // 小計
        }
      ]
    },
    {
      "merchant_order_no": "ORDER20250101002",  // 商家訂單編號
      "category": "B2C",  // 發票類別：B2B=公司, B2C=個人
      "buyer_name": "王小明",  // 買受人姓名
      "buyer_email": "wang@example.com",  // Email
      "buyer_phone": "0912-345-678",  // 電話
      "carrier_type": "0",  // 載具類型（參考下方對照表）
      "carrier_num": "/ABC1234",  // 載具號碼
      "print_flag": "N",  // 列印旗標：Y=列印, N=不列印
      "tax_type": "1",  // 課稅類別（參考下方對照表）
      "amt": 1300,  // 未稅金額
      "tax_amt": 65,  // 稅額
      "total_amt": 1365,  // 含稅總額
      "items": [  // 發票品項
        {
          "name": "書籍",  // 品項名稱
          "count": 2,  // 數量
          "unit": "本",  // 單位
          "price": 650,  // 單價
          "amt": 1300  // 小計
        }
      ]
    }
  ]
}
```

### ezPay 載具類型 (carrier_type)
| 代碼 | 說明 | 號碼格式 |
|------|------|----------|
| 0 | 手機條碼 | /+7碼 |
| 1 | 自然人憑證 | 2英文+14數字 |
| 2 | ezPay載具 | Email |
| donate | 愛心碼捐贈 | 3-7位數字（donation=1, love_code=號碼）|

### ezPay 稅率類型 (tax_type)
| 代碼 | 說明 | tax_rate |
|------|------|----------|
| 1 | 應稅 | 5 |
| 2 | 零稅率 | 0 |
| 3 | 免稅 | 0 |

---

## 📋 OPay 範本

```jsonc
{
  "provider": "opay",  // 平台代碼，固定值
  "production": {  // 正式環境憑證
    "merchant_id": "YOUR_MERCHANT_ID",
    "hash_key": "YOUR_HASH_KEY",
    "hash_iv": "YOUR_HASH_IV"
  },
  "test": {  // 測試環境憑證
    "merchant_id": "YOUR_MERCHANT_ID",
    "hash_key": "YOUR_HASH_KEY",
    "hash_iv": "YOUR_HASH_IV"
  },
  "invoices": [
    {
      "merchant_order_no": "ORDER20250101001",  // 商家訂單編號
      "category": "B2B",  // 發票類別：B2B=公司, B2C=個人
      "buyer_name": "黑閃實驗室",  // 公司或買受人姓名
      "buyer_ubn": "93067949",  // 統一編號（8位數字）
      "buyer_address": "台北市信義區市府路45號89樓",  // 公司或買受人地址
      "buyer_email": "u@blackflash.network",  // Email
      "buyer_phone": "02-8101-2345",  // 電話
      "print_flag": "Y",  // 列印旗標：Y=列印, N=不列印
      "tax_type": "1",  // 課稅類別（參考下方對照表）
      "tax_rate": 5,  // 稅率（%）
      "amt": 10000,  // 未稅金額
      "tax_amt": 500,  // 稅額
      "total_amt": 10500,  // 含稅總額
      "items": [  // 發票品項
        {
          "name": "軟體授權",  // 品項名稱
          "count": 1,  // 數量
          "unit": "套",  // 單位
          "price": 10000,  // 單價
          "amt": 10000  // 小計
        }
      ]
    },
    {
      "merchant_order_no": "ORDER20250101002",  // 商家訂單編號
      "category": "B2C",  // 發票類別：B2B=公司, B2C=個人
      "buyer_name": "王小明",  // 買受人姓名
      "buyer_email": "wang@example.com",  // Email
      "buyer_phone": "0912-345-678",  // 電話
      "carrier_type": "3",  // 載具類型（參考下方對照表）
      "carrier_num": "/ABC1234",  // 載具號碼
      "print_flag": "N",  // 列印旗標：Y=列印, N=不列印
      "tax_type": "1",  // 課稅類別（參考下方對照表）
      "amt": 1300,  // 未稅金額
      "tax_amt": 65,  // 稅額
      "total_amt": 1365,  // 含稅總額
      "items": [  // 發票品項
        {
          "name": "書籍",  // 品項名稱
          "count": 2,  // 數量
          "unit": "本",  // 單位
          "price": 650,  // 單價
          "amt": 1300  // 小計
        }
      ]
    }
  ]
}
```

### OPay 載具類型 (carrier_type)
| 代碼 | 說明 | 號碼格式 |
|------|------|----------|
| 1 | OPay載具 | Email |
| 2 | 自然人憑證 | 2英文+14數字 |
| 3 | 手機條碼 | /+7碼 |
| 4 | 悠遊卡 | 16位數字 |
| 5 | icash | 8位字元以上 |
| 6 | 一卡通 | 16位數字 |
| 7 | 金融卡 | 16位數字 |
| 8 | 信用卡 | 16位數字（需carrier_num2：民國年月日7碼+金額10碼）|
| donate | 愛心碼捐贈 | 3-7位數字（donation=1, love_code=號碼）|

### OPay 稅率類型 (tax_type)
| 代碼 | 說明 | tax_rate |
|------|------|----------|
| 1 | 應稅 | 5 |
| 2 | 零稅率 | 0 |
| 3 | 免稅 | 0 |

---

## 📋 SmilePay 範本

```jsonc
{
  "provider": "smilepay",  // 平台代碼，固定值
  "production": {  // 正式環境憑證
    "merchant_id": "YOUR_MERCHANT_ID",
    "hash_key": "YOUR_HASH_KEY",
    "hash_iv": "YOUR_HASH_IV",
    "dcvc": "YOUR_DCVC"
  },
  "test": {  // 測試環境憑證
    "merchant_id": "YOUR_MERCHANT_ID",
    "hash_key": "YOUR_HASH_KEY",
    "hash_iv": "YOUR_HASH_IV",
    "dcvc": "YOUR_DCVC"
  },
  "invoices": [
    {
      "merchant_order_no": "ORDER20250101001",  // 商家訂單編號
      "category": "B2B",  // 發票類別：B2B=公司, B2C=個人
      "buyer_name": "黑閃實驗室",  // 公司或買受人姓名
      "buyer_ubn": "93067949",  // 統一編號（8位數字）
      "buyer_address": "台北市信義區市府路45號89樓",  // 公司或買受人地址
      "buyer_email": "u@blackflash.network",  // Email
      "buyer_phone": "02-8101-2345",  // 電話
      "print_flag": "Y",  // 列印旗標：Y=列印, N=不列印
      "tax_type": "1",  // 課稅類別（參考下方對照表）
      "tax_rate": 5,  // 稅率（%）
      "amt": 10000,  // 未稅金額
      "tax_amt": 500,  // 稅額
      "total_amt": 10500,  // 含稅總額
      "items": [  // 發票品項
        {
          "name": "軟體授權",  // 品項名稱
          "count": 1,  // 數量
          "unit": "套",  // 單位
          "price": 10000,  // 單價
          "amt": 10000  // 小計
        }
      ]
    },
    {
      "merchant_order_no": "ORDER20250101002",  // 商家訂單編號
      "category": "B2C",  // 發票類別：B2B=公司, B2C=個人
      "buyer_name": "王小明",  // 買受人姓名
      "buyer_email": "wang@example.com",  // Email
      "buyer_phone": "0912-345-678",  // 電話
      "carrier_type": "3J0002",  // 載具類型（參考下方對照表）
      "carrier_num": "/ABC1234",  // 載具號碼
      "print_flag": "N",  // 列印旗標：Y=列印, N=不列印
      "tax_type": "1",  // 課稅類別（參考下方對照表）
      "amt": 1300,  // 未稅金額
      "tax_amt": 65,  // 稅額
      "total_amt": 1365,  // 含稅總額
      "items": [  // 發票品項
        {
          "name": "書籍",  // 品項名稱
          "count": 2,  // 數量
          "unit": "本",  // 單位
          "price": 650,  // 單價
          "amt": 1300  // 小計
        }
      ]
    }
  ]
}
```

### SmilePay 載具類型 (carrier_type)
| 代碼 | 說明 | 號碼格式 |
|------|------|----------|
| EJ0113 | 速買配載具 | Email 或手機 |
| 3J0002 | 手機條碼 | /+7碼 |
| CQ0001 | 自然人憑證 | 2英文+14數字 |
| donate | 愛心碼捐贈 | 3-7位數字（carrier_type=EJ0113, carrier_num=愛心碼）|

### SmilePay 稅率類型 (tax_type)
| 代碼 | 說明 | tax_rate |
|------|------|----------|
| 1 | 應稅 | 5 |
| 2 | 零稅率 | 0 |
| 3 | 免稅 | 0 |

---

## 📋 Amego 範本

```jsonc
{
  "provider": "amego",  // 平台代碼，固定值
  "production": {  // 正式環境憑證
    "merchant_id": "YOUR_MERCHANT_ID",
    "hash_key": "YOUR_HASH_KEY",
    "hash_iv": "YOUR_HASH_IV"
  },
  "test": {  // 測試環境憑證
    "merchant_id": "YOUR_MERCHANT_ID",
    "hash_key": "YOUR_HASH_KEY",
    "hash_iv": "YOUR_HASH_IV"
  },
  "invoices": [
    {
      "merchant_order_no": "ORDER20250101001",  // 商家訂單編號
      "category": "B2B",  // 發票類別：B2B=公司, B2C=個人
      "buyer_name": "黑閃實驗室",  // 公司或買受人姓名
      "buyer_ubn": "93067949",  // 統一編號（8位數字）
      "buyer_address": "台北市信義區市府路45號89樓",  // 公司或買受人地址
      "buyer_email": "u@blackflash.network",  // Email
      "buyer_phone": "02-8101-2345",  // 電話
      "print_flag": "Y",  // 列印旗標：Y=列印, N=不列印
      "tax_type": "1",  // 課稅類別（參考下方對照表）
      "tax_rate": 5,  // 稅率（%）
      "amt": 10000,  // 未稅金額
      "tax_amt": 500,  // 稅額
      "total_amt": 10500,  // 含稅總額
      "items": [  // 發票品項
        {
          "name": "軟體授權",  // 品項名稱
          "count": 1,  // 數量
          "unit": "套",  // 單位
          "price": 10000,  // 單價
          "amt": 10000  // 小計
        }
      ]
    },
    {
      "merchant_order_no": "ORDER20250101002",  // 商家訂單編號
      "category": "B2C",  // 發票類別：B2B=公司, B2C=個人
      "buyer_name": "王小明",  // 買受人姓名
      "buyer_email": "wang@example.com",  // Email
      "buyer_phone": "0912-345-678",  // 電話
      "carrier_type": "3J0002",  // 載具類型（參考下方對照表）
      "carrier_num": "/ABC1234",  // 載具號碼
      "print_flag": "N",  // 列印旗標：Y=列印, N=不列印
      "tax_type": "1",  // 課稅類別（參考下方對照表）
      "amt": 1300,  // 未稅金額
      "tax_amt": 65,  // 稅額
      "total_amt": 1365,  // 含稅總額
      "items": [  // 發票品項
        {
          "name": "書籍",  // 品項名稱
          "count": 2,  // 數量
          "unit": "本",  // 單位
          "price": 650,  // 單價
          "amt": 1300  // 小計
        }
      ]
    }
  ]
}
```

### Amego 載具類型 (carrier_type)
| 代碼 | 說明 | 號碼格式 |
|------|------|----------|
| amego | 光貿會員載具 | Email |
| 3J0002 | 手機條碼 | /+7碼 |
| CQ0001 | 自然人憑證 | 2英文+14數字 |
| donate | 愛心碼捐贈 | 3-7位數字（donation=1, love_code=號碼）|

### Amego 稅率類型 (tax_type)
| 代碼 | 說明 | tax_rate |
|------|------|----------|
| 1 | 應稅 | 5 |
| 2 | 零稅率 | 0 |
| 3 | 免稅 | 0 |

---

## 💡 使用提示詞

```
請參考以下 JSON 範本，將我的訂單資料轉換成相同格式。
範本中的載具類型和稅率類型請參考下方對照表選擇正確的代碼。

【範本】
（貼上你選擇的平台範本）

【我的訂單資料】
（貼上你的訂單資料）

請產生完整 JSON。
```
