# 轉折研究室：ChatGPT 網頁版／手機版交接

程式來源：https://github.com/meng049-cmd/TWStockSearch/tree/feat/tw-turning-lab
下載完整 ZIP：https://github.com/meng049-cmd/TWStockSearch/archive/refs/heads/feat/tw-turning-lab.zip
網站：https://tw-turning-lab.snugbirch1.chatgpt.site

## 在 ChatGPT 模式接續
下載上方 ZIP，在 ChatGPT 新對話上傳，貼上以下需求。Codex 無法自行切換使用者的模式或把附件送入另一段對話。

> 請依上傳的轉折研究室程式碼，維護同一套響應式網站，桌面全螢幕與手機皆可用。這是 Vinext、Cloudflare Workers、D1 專案，不是單檔靜態 HTML。保留後端 API、私人存取限制、資料庫、原有筆記與排程。不要修改 TWStockSearch 的 main 或台股盤後選股頁。
>
> 核心是依選定日期已完成的走勢，以外資、融資、成交量及收盤漲跌給出每日盤後解讀。缺資料不當零、期貨不套用現股融資、不宣稱能預測隔日。
>
> 價量、成交量、動能與跨股票／期貨比較必須使用相同的已套用日期起訖、縮放與平移視窗。缺歷史資料應說明與補入有效官方資料，不虛構 K 棒。不要只改日期標籤。
>
> 桌面保留圖表與側欄，較窄視窗轉單欄，手機提供足夠點擊區與可捲動資料表。修改後執行 scripts/test-client.cjs、test-market.cjs、test-search.cjs、test-indicators.cjs、test-daily-summary.cjs、test-chart-model.cjs、test-chart-workspace.cjs、test-sync-plan.cjs、test-sync.cjs、test-import-sync.cjs 與 npm run build。回報實際驗證範圍。

## 資料與發布

- lib/history-reference.json：從 TWStockSearch 官方證交所歷史快照整理，三檔上市股票 2026-01-02～2026-10-08 的 OHLC／成交量（股數除 1,000 轉張）。不包含歷史法人或融資，這些欄位為 null。匯入採 ignore，不覆蓋已存行情、籌碼或使用者修正。
- 私人 D1 資料與筆記不在 ZIP 中；上傳程式不會把資料庫內容複製至新網站。
- .openai/hosting.json 指向現有私人 Sites；保留原網站時沿用，若另建新網站必須由 Sites 正規建立新身份與資料庫，不沿用舊身份。
- Git 分支與 Sites 原始碼儲存庫是不同端點；發布必須先同步受測原始碼，再保存並部署同一份建置成品。
