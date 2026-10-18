# 轉折研究室自動部署

監看來源：meng049-cmd/TWStockSearch 的 feat/tw-turning-lab 分支。
部署目標：https://tw-turning-lab.snugbirch1.chatgpt.site

採 ChatGPT 自動化每小時檢查新提交；不是 GitHub push webhook，因此推送後可能等待約一小時。只有新提交且測試、建置成功時發布。沒有新提交則不部署；失敗保留線上版本並回報。main 與舊選股網站不在部署範圍。

Sites 的來源儲存庫與 GitHub 是不同端點。同步後在 Sites 來源的 .openai/github-deployment.json 記錄已發布 GitHub SHA，避免重複發布。保留原 hosting project_id、私人 audience、DB binding、資料庫記錄與行情更新排程。

執行時才由 Sites 取得短效 Git 憑證；不把憑證放到 GitHub Secrets、原始碼、檔案或日誌。驗證指令見 docs/CHATGPT-HANDOFF.md。
