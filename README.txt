MONEY PLAN — iPhone PWA

FILES
- index.html
- styles.css
- app.js
- manifest.webmanifest
- sw.js
- icons/icon-192.png
- icons/icon-512.png

IMPORTANT
A PWA must be served over HTTPS (or localhost) for installation/service-worker support.
The easiest free option is GitHub Pages.

GITHUB PAGES SETUP
1. Create a GitHub account if needed.
2. Create a new repository, e.g. money-plan.
3. Upload all files from this folder, keeping the icons folder.
4. Repository Settings -> Pages.
5. Under Build and deployment choose "Deploy from a branch".
6. Choose the main branch and root (/) and save.
7. GitHub will give you an HTTPS Pages URL.

IPHONE INSTALL
1. Open the HTTPS Pages URL in Safari on the iPhone.
2. Tap Share.
3. Tap "Add to Home Screen".
4. Keep the suggested name "Money Plan".
5. Tap Add.
6. Open the new Home Screen icon. It runs as a standalone app.

DATA
Expenses, plans, recurring items and savings settings are stored locally in the browser on the device using localStorage. This version does not upload your financial data to a server.

BACKUP
Because the data is local, this first version does not synchronize between devices. If you clear Safari website data or move to another device, the data may not transfer. A future version can add encrypted cloud backup/iCloud-style sync.
