# 快速開始

## 基本流程

1. 準備包含憑證和發票資料的 JSON 檔案
2. 點擊底部 + 按鈕上傳 JSON 檔案
3. 系統自動偵測平台並載入發票列表
4. 檢視發票列表，確認資料正確
5. 點擊底部 Start 按鈕開始批次開立
6. 即時顯示開立狀態與結果

## 線上使用

訪問 [https://invoice.lazypro.app](https://invoice.lazypro.app)

## 離線使用

下載專案在本機 PHP 環境執行：

1. 下載專案：[GitHub Repository](https://github.com/LazyProApp/Invoice)
2. 啟動 PHP 內建伺服器：`php -S localhost:8000`
3. 瀏覽器訪問 `http://localhost:8000`

## 準備 JSON 檔案

JSON 檔案包含兩部分：
1. **憑證資訊**：加值中心的 API 憑證
2. **發票資料**：要開立的發票列表

詳細格式請參閱：
- [使用 AI 轉換訂單資料](02-ai-convert.md)
- [JSON 檔案格式](03-json-format.md)

## 測試與正式模式

**測試模式**（預設）：
- 使用各平台的測試環境
- 不會產生正式發票
- 用於驗證資料格式與流程

**正式模式**：
- 在 JSON 檔案中設定 `"production": true`
- 會開立正式發票


## 安全提醒

- API 憑證是敏感資訊
- 不要將 JSON 檔案上傳到公開位置
- 線上版使用 Cloudflare Workers 轉發，不記錄任何資料
- 離線版資料完全不外傳
