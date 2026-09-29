MONEY PLAN V2

Replace the files in your existing GitHub repository with:
- index.html
- app.js
- styles.css
- manifest.webmanifest
- sw.js
- icons/

Keep the same repository and GitHub Pages URL.

V2 logic:
1. Income
2. Fixed commitments
3. Savings target
4. Remaining variable-spending pool
5. Daily allowance based on remaining days
6. Actual vs planned spending
7. Month-end spending forecast
8. Savings projection
9. Recurring income/expenses
10. JSON backup/restore

IMPORTANT:
This version uses localStorage. It is not a bank-connected app and does not upload financial data.

After replacing files, refresh the website. If an already-installed iPhone PWA still shows V1, fully close it and reopen it. The service worker cache is versioned as money-plan-v2.

Before using the app as your only financial record, export a backup periodically from Settings.
