# 載具類型說明

## 功能

設定發票的載具類型，決定發票的寄送與儲存方式。

## 載具類型

### 1. 會員載具（手機條碼）
- **適用**：客戶使用手機條碼
- **設定**：`CarrierType: "3"` 或 `""`，並提供 `CarrierNum`（手機條碼）
- **格式**：7 碼英數字，開頭為 `/`（例如：`/ABC1234`）

### 2. 自然人憑證載具
- **適用**：客戶使用自然人憑證
- **設定**：`CarrierType: "2"`，並提供 `CarrierNum`（憑證號碼）
- **格式**：16 碼英數字，開頭 2 碼為大寫英文

### 3. 捐贈
- **適用**：客戶選擇捐贈發票
- **設定**：`LoveCode: "捐贈碼"`（3-7 碼數字）
- **不需要**：CarrierType 和 CarrierNum

### 4. 紙本發票（一般）
- **適用**：不使用載具，列印紙本
- **設定**：`Print: "1"`
- **不需要**：CarrierType、CarrierNum、LoveCode

### 5. B2B 發票（開立給公司）
- **適用**：開立給有統一編號的公司
- **設定**：`CustomerIdentifier: "統一編號"`（8 碼數字）
- **不需要**：CarrierType、CarrierNum

## 設定範例

### 手機條碼
```json
{
  "Print": "0",
  "CarrierType": "3",
  "CarrierNum": "/ABC1234"
}
```

### 自然人憑證
```json
{
  "Print": "0",
  "CarrierType": "2",
  "CarrierNum": "AB12345678901234"
}
```

### 捐贈
```json
{
  "Print": "0",
  "LoveCode": "001"
}
```

### 紙本發票
```json
{
  "Print": "1"
}
```

### B2B 發票
```json
{
  "Print": "1",
  "CustomerIdentifier": "12345678",
  "CustomerName": "公司名稱",
  "CustomerAddr": "公司地址"
}
```

## 平台差異

不同平台的載具欄位名稱可能略有差異，請參考對應平台的範本檔案（`invoice-templates/` 目錄）。
