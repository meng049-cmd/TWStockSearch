# 轉折研究室獨立分支

此分支匯入轉折研究室 Sites 原始碼，來源 commit：84b2df77772b38674a73c74ced4a7970de705b7a。

網站：https://tw-turning-lab.snugbirch1.chatgpt.site

這是 Vinext + Cloudflare Workers + D1 專案，不能使用 GitHub Pages 靜態部署。此分支不包含舊選股頁的 Pages 工作流程，也不修改 main。原有 Sites 私人存取限制、資料庫與排程維持原設定；GitHub 分支不會自動同步部署到 Sites。

程式測試：node scripts/test-search.cjs、node scripts/test-indicators.cjs、node scripts/test-client.cjs、node scripts/test-market.cjs。後端與搜尋測試需要 TypeScript；資料庫測試使用 Node 22+ 的 node:sqlite。
