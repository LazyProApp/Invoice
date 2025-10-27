# 離線版本部署

## 功能

在本機 PHP 環境執行 Lazy Invoice，資料完全不外傳。

## 部署步驟

### 1. 下載專案
```bash
git clone https://github.com/LazyProApp/Invoice.git
cd Invoice
```

### 2. 檢查 PHP 環境
確認已安裝 PHP 7.0 以上版本：
```bash
php -v
```

### 3. 啟動伺服器
使用 PHP 內建伺服器：
```bash
php -S localhost:8000
```

或指定其他 port：
```bash
php -S localhost:3000
```

### 4. 訪問介面
瀏覽器開啟：
- `http://localhost:8000`（預設）
- `http://localhost:3000`（自訂 port）

## 目錄結構

```
Invoice/
├── index.html          # 主介面
├── js/                 # JavaScript 模組
├── assets/             # 靜態資源
├── api/                # PHP API 檔案（離線版需要）
└── invoice-templates/  # JSON 範本
```

## API 轉發

離線版使用 PHP 轉發 API 請求：
- `api/kick.php`：統一 API 端點
- 處理加密與簽章
- 呼叫各平台 API

## 與線上版差異

| 項目 | 線上版 | 離線版 |
|-----|-------|-------|
| 資料處理 | Cloudflare Workers 轉發 | 本機 PHP 處理 |
| 隱私性 | Workers 不記錄資料 | 資料完全不外傳 |
| 部署需求 | 無 | PHP 7.0+ 環境 |
| 適用場景 | 快速使用 | 對隱私要求極高 |

## 安全建議

- 離線版僅在本機執行，不要部署到公開伺服器
- 定期更新專案取得最新功能與安全修正
- 妥善保管包含憑證的 JSON 檔案
