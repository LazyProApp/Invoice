# JSON 檔案格式

## 檔案結構

```json
{
  "production": false,
  "credential": {
    "MerchantID": "商店代號",
    "HashKey": "加密金鑰",
    "HashIV": "加密向量"
  },
  "invoices": [
    {
      "RelateNumber": "訂單編號",
      "CustomerName": "客戶名稱",
      "CustomerEmail": "客戶信箱",
      "Print": "0",
      "TaxType": "1",
      "SalesAmount": 1000,
      "Items": [
        {
          "ItemName": "商品名稱",
          "ItemCount": 1,
          "ItemWord": "個",
          "ItemPrice": 1000,
          "ItemAmount": 1000
        }
      ]
    }
  ]
}
```

## 主要欄位說明

### production
- **型態**：布林值
- **說明**：`true` 為正式模式，`false` 為測試模式
- **預設值**：`false`

### credential
- **型態**：物件
- **說明**：加值中心的 API 憑證
- **必填欄位**：
  - `MerchantID`：商店代號
  - `HashKey`：加密金鑰
  - `HashIV`：加密向量

### invoices
- **型態**：陣列
- **說明**：要開立的發票列表
- **每筆發票包含**：
  - 訂單資訊（RelateNumber、CustomerName 等）
  - 稅額設定（TaxType、SalesAmount）
  - 商品明細（Items 陣列）

## 範本檔案

各平台的完整範本位於專案根目錄：

```
invoice-templates/
├── ecpay.json      # 綠界科技（含所有稅率範例）
├── ezpay.json      # 藍新金流
├── opay.json       # 歐付寶
├── smilepay.json   # 訊航科技
└── amego.json      # 雲端行動
```

## 欄位差異

不同平台的欄位名稱可能略有差異，請參考對應平台的範本檔案。
