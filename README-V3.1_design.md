# Money Plan V3.1

V3.1 is the first local-first + cloud-sync version of Money Plan.

## Financial model

- Financial cycle: 25th → 24th; cycle names are based on the ending month.
- User-facing dates use DD-MM-YYYY.
- Salary + previous-cycle carry-in + other income + recurring income = available cash.
- Recurring expenses repeat indefinitely.
- Installments repeat for a fixed number of financial cycles and stop automatically.
- Visa, 3oshour and spontaneous spending are entered per cycle.
- One-off expenses are individual records and do not repeat.
- Your Revolut contribution reduces cash available for the cycle.
- Wife's Revolut contribution is tracked separately (default €1,500) and does not reduce your cash-flow calculation.
- University savings target: €72,000 by September 2028.
- Current Revolut balance counts immediately toward target progress.

## V3.1 cloud data model

The local financial state remains the app's working model. Cloud Firestore stores user-owned records separately so the app can synchronize them across devices:

```text
users/{uid}/cycles/{cycleKey}
users/{uid}/expenses/{expenseId}
users/{uid}/recurring/{itemId}
users/{uid}/savingsHistory/{historyId}
users/{uid}/meta/savings
```

Each financial record carries synchronization metadata internally. A device ID and client timestamp are used for conflict detection. Firestore server timestamps are used for cloud ordering.

## Offline-first behavior

The app continues to work from its local state. Firestore Web persistence is enabled with a persistent multi-tab cache, so Firestore itself can cache active cloud data and queue changes while offline. When connectivity returns, Firebase synchronizes the queued changes. Firebase documents that offline web persistence is supported by Safari, Chrome and Firefox and that multiple writes to the same document use last-write-wins; Money Plan adds its own conflict notices when a local unsynced record and a remote change are both detected.

## Firebase setup

The sync layer is coded, but the app cannot connect to your private Firebase project until you add your project configuration.

1. Open the Firebase Console.
2. Create a project (the no-cost Spark plan is sufficient for this personal app at normal usage).
3. Register a Web App.
4. Enable Authentication → Email/Password.
5. Create a Cloud Firestore database.
6. In Project settings → Your apps → Web app, copy the Firebase configuration object.
7. Replace the `REPLACE_ME` values in `firebase-config.js`.
8. Publish the included `firestore.rules` to your Firestore database.
9. Upload all V3.1 files to the existing GitHub Pages repository.

Firebase's web SDK documentation recommends the modular API and provides browser-module CDN usage; this build uses the current Firebase JavaScript SDK 12.19.0 CDN modules.

## Security

The included Firestore rules require Firebase Authentication and restrict each user's data path to that user's Firebase UID. Do not use open `allow read, write: if true` rules. Firebase explicitly recommends Authentication + Security Rules for user-owned data.

The Firebase web config contains a public client API key; do not place a Firebase Admin/service-account private key in this repository.

## First sync test — do NOT use real financial data yet

1. Create one Money Plan account.
2. Sign in on the iPad.
3. Add a harmless test one-off expense.
4. Open the same app on the iPhone and sign in with the same account.
5. Confirm the test record appears.
6. Edit it on the iPhone and confirm the iPad updates.
7. Put one device offline, make a harmless change, reconnect, and confirm it synchronizes.
8. Only after this test succeeds should you enter/import the real financial data.

## Backup

Keep using Export backup / Import backup. Cloud synchronization is not a replacement for a personal backup.
