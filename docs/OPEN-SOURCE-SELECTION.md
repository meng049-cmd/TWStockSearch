# 成熟觀測工作台選型與套用

2026-10-18 讀取 GitHub API 的候選快照；星數會變動，並非宣稱全 GitHub 絕對排名。

| 專案 | Stars | 授權 | 本站決策 |
| --- | ---: | --- | --- |
| ZhuLinsen/daily_stock_analysis | 66,691 | MIT | 採用其「先報告概覽，再策略／證據與透明度」的觀測工作台配置原則與淺色設計 token，改作台股／期貨每日盤後觀察。 |
| tradingview/lightweight-charts | 17,612 | Apache-2.0 | 實際整合 5.2.1 本地 standalone production 套件，取代主要圖表的自繪 SVG 互動。 |
| ghostfolio/ghostfolio | 9,510 | AGPL-3.0 | 偏資產／投資組合管理，非本次每日價量與籌碼觀察的主要工作流，未匯入其程式。 |

## 實際套用範圍

- 主體為既有轉折研究室，保留 Vinext／Workers／D1、官方台股／期貨來源與私人資料庫；沒有搬入 daily_stock_analysis 的 Python 後端、AI 金鑰、交易建議或通知服務。工作台配置與 CSS 做本地適配，不宣稱是原專案的完整部署。
- 結論先行、四項數據證據、固定觀察清單、日期篩選常駐，新增與說明區收合；桌面側欄與手機底部導覽分別適配。
- 四類圖表共用相同日曆軸，拖曳、滾輪與觸控縮放同步。游標跨圖同步；點選日期更新既有日結論。
- 套件本地載入，無執行期 CDN 依賴。public/vendor 保留 Apache 2.0／MIT license 與 TradingView NOTICE，網站附來源與署名。
- 缺行情、缺籌碼與尚未暖機的指標使用 whitespace，不造 K 棒、不填零；零成交量與有效的零指標仍保留。比較基期固定在已套用日期區間的首個共同交易日，縮放不重設基期。
- 若金融圖表引擎不可用，退回原有簡易圖表並標示狀態，不宣稱仍在使用原生互動圖表。

## 驗證

原測試：test-client.cjs、test-market.cjs、test-search.cjs、test-indicators.cjs、test-daily-summary.cjs。
新增：test-chart-model.cjs 驗證真實／缺失值與零值、共同比較、日期與重複縮放邊界；test-chart-workspace.cjs 以圖表 API 替身驗證四圖同步、重入防護、點選觀察日、游標同步、移除舊圖表與失敗退回。npm run build 驗證實際套件與站點建置。
API 替身測試不等於瀏覽器實機驗證；未提供受支援的瀏覽器工具時，須明確保留此驗證限制。
