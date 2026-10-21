# TWStockSearch 整合研究工作區

由「市場選股」切換「轉折研究」，或在焦點個股、候選股清單與 K 線上按「研究」。兩個工作區共用選取標的及明暗主題。研究工作區以同網域的 `research/index.html` 載入，亦可直接開啟 `research/index.html?stock=2330`。

## 功能

- 日／週／月 K 線、成交量、法人、融資及技術指標共用時間軸，支援縮放、平移與十字線。
- KD、MACD、RSI、布林通道、OBV、ATR、ROC；資料暖機不足時不產生數值。
- 2～6 個標的以共同日期比較，價格指數以區間首個共同週期為 100。
- 每日盤後歸納、轉折事件、每日籌碼明細及研究筆記。
- CSV 預覽、合併匯入、匯出；期貨依契約月份和日夜盤分開，成交量為口。
- 筆記和匯入資料存於瀏覽器 IndexedDB；不支援時嘗試 localStorage。可匯出／還原 JSON 備份。它們不會提交到公開 GitHub，也不會同步原 Sites 的私人資料庫。

## 官方資料

股票讀取既有 `data/stocks.json` 與 `data/history/<code>.json`。原有 `foreignBuy`／`trustBuy` 是買進股數，仍供原選股條件使用，不能當成淨買賣超。

`scripts/sync_research.py` 另外取得最近 20 個交易日的 T86 淨買賣超與 MI_MARGN 融資餘額變化，新增 `foreignNet`、`trustNet`、`dealerNet`（股）及 `marginChange`（張）。研究介面把股票的成交股數和法人淨股數除以 1,000 換成張。外資口徑為不含外資自營商的外陸資淨買賣超加外資自營商淨買賣超。

期貨透過期交所 `DailyMarketReportFut` 累積 `data/research-futures.json`。歷史從成功取得的快照開始；較早區間用 CSV 匯入。不跨契約拼接，不把日資料當作分鐘資料。分鐘圖使用 TradingView 外部參考。

研究資料排程約每四小時檢查，和既有官方資料工作流程一起發布。`data/research-status.json` 保存來源警告；失敗時保留先前資料，缺少籌碼維持 null。頁面刷新只會重讀已發布快照，不會觸發官方爬取。

## 開發與驗證

靜態頁面不需要編譯。`node --test scripts/test-pages-data.cjs` 檢查資料轉換、個人儲存、合併與備份；`python -m unittest discover -s scripts -p test_research.py` 檢查官方欄位與單位解析。

`Publish website` 和 `Update official stock data` 兩個流程都必須複製 `index.html`、`data/`、`assets/`、`research/` 至發布目錄。原始 Sites 專案及託管資料庫不會因 GitHub 部署而變更。

視覺布局參考 shadcn/ui 官方 Dashboard Blocks 的側欄、指標卡、圖表與表格分層：https://ui.shadcn.com/blocks?category=dashboard 。實作保留靜態 HTML/JS 架構與既有資料排程。
