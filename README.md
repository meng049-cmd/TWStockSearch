# 台股投資研究面板

[開啟網站](https://meng049-cmd.github.io/TWStockSearch/)

專案僅包含以下功能：

- 上市／上櫃股票代號與名稱搜尋、可上下捲動的最近查詢記錄。
- 個股 K 線／收盤線圖、成交量、均線、布林、MACD、KD、RSI、OBV、外資與融資副圖。
- 日期觀察、量價與法人分析、手動買賣及研究註記、可選的均線交叉觀察標記。
- 個股、中文國際股市、最新財經三類新聞輪播。
- 最後一區呈現所選個股與台股大盤的技術、籌碼分析。

## 結構

`index.html` 是唯一頁面。`assets/desk.js` 管理介面、圖表、查詢記錄與註記；純資料處理在 `assets/core.js`。技術指標與籌碼規則為獨立模組，圖表套件與授權位於 `assets/vendor/`。

`data/stocks.json` 提供上市目錄及近期官方行情，`data/history/` 依股票提供日歷史；`data/news.json` 同時提供中文新聞及官方大盤快照；`data/announcements.json` 提供個股重大訊息。上櫃目錄位於 `assets/otc-symbols.json`，行情由外部圖表提供，尚無本地籌碼資料。

每小時同步中文新聞、個股重大訊息與大盤來源。台灣交易日 18:30 排程更新盤後行情，法人與融資每四小時檢查。GitHub 排程可能延遲；介面明示實際資料日。來源失敗保留舊快照，缺值不當成零。

手動買賣與研究註記只儲存在瀏覽器；不代表券商成交。均線交叉標記不是買賣指令。個股淨額以張為單位，大盤法人資料以元為單位，不互相替代。

## 檢查

```
node --test tests/*.test.cjs
python -m unittest discover -s tests -p 'test_*.py'
```

網站採無建置靜態 HTML／CSS／JS；GitHub Pages 部署僅包含 `index.html`、`assets/` 與 `data/`。舊 App、評分、選股、轉折工作區、匯入與獨立下載版本已移除。
