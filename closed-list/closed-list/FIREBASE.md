# Account sync

Project: inprogress-planner (Spark plan). Google is the only enabled sign-in provider.
Production authorized domain: inprogress-planner.vercel.app. Local testing: localhost.
Firestore Standard database: (default), asia-south1.

Firebase web configuration is public client configuration; security comes from Firebase Authentication and firestore.rules. Never add service account credentials to this repository.

Tasks live in workspaces/{Firebase user ID}. Rules permit only the matching signed-in account, validate the workspace shape, and limit the closed list to five. No public reads, cross-account reads, or client document deletion are allowed. Publish firestore.rules in Firebase Console whenever changing the rules; firebase.json also supports authenticated Firebase CLI deployment.

Guest tasks remain under closed-list:v1 in browser storage. Signing in shows the account workspace, with an explicit option to merge browser tasks. The original guest copy remains. Each account has a separate browser recovery cache and pending operation queue. Pending edits are sent through transactions and replayed against the latest cloud version. Unsent changes prevent sign-out. Existing legacy completion totals are retained; history begins with this version.

Run node --test src/sync/workspace.test.js and npm run build. End-to-end verification additionally requires completing Google login, confirming Synced across devices, and checking a task change in another signed-in session. Verify that unauthorized reads are denied before production use.
