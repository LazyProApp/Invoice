# 使用 AI 轉換訂單資料

## 功能

使用 AI 工具（如 Claude、ChatGPT）將訂單資料轉換為標準 JSON 格式。

## 操作流程

1. 準備訂單資料（Excel、CSV、文字等）
2. 開啟 AI 工具（Claude 或 ChatGPT）
3. 上傳或貼上訂單資料
4. 提供轉換指令（見下方範例）
5. AI 輸出標準 JSON 格式
6. 複製 JSON 儲存為檔案

## AI 轉換指令範例

```
請將這些訂單資料轉換為 Lazy Invoice 的 JSON 格式。

平台：ECPay
測試模式：是
憑證：
- MerchantID: 2000132
- HashKey: ejCk326UnaZWKisg
- HashIV: q9jcZX8Ib9LM8wYk

發票資料：
[貼上你的訂單資料]

請參考 invoice-templates/ecpay.json 的格式輸出。
```

## 範本位置

專案提供各平台的完整 JSON 範本：

```
invoice-templates/
├── ecpay.json      # 綠界科技
├── ezpay.json      # 藍新金流
├── opay.json       # 歐付寶
├── smilepay.json   # 訊航科技
└── amego.json      # 雲端行動
```

## 完整轉換指南

詳細的 AI 轉換指南請參閱專案根目錄：
- [AI-PROMPT-GUIDE.md](../AI-PROMPT-GUIDE.md)

包含：
- 各平台 JSON 範本與欄位說明
- 載具類型與稅率對照表
- AI 轉換提示詞範例
- 特殊稅率發票處理方式
