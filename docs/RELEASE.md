# Building Hopbag for Android testers

Builds run on Expo's servers (EAS), so you don't need Android Studio. Run these commands from the project folder, signed in to your Expo account.

## One-time setup

1. **Link the project** to your Expo account. This adds `extra.eas.projectId` to `app.json`; commit that change:
   ```
   npx eas-cli@latest login
   npx eas-cli@latest init
   ```
2. **Check the app id.** `app.json` uses `com.hopbag.app` (`android.package`). **It can never change once uploaded to Google Play**, so confirm it first. A domain you own, reversed, is the usual choice (for example `in.hopbag.app`).
3. **Public config for builds.** `.env` stays on your computer, so give EAS the same two public values, once per environment (`development`, `preview`, `production`):
   ```
   npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value https://<ref>.supabase.co --visibility plaintext
   npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value sb_publishable_... --visibility plaintext
   ```
   Never add the service role key or any Razorpay secret here.
4. **Push notifications.** Create a Firebase project, download the FCM V1 service account key, and upload it in EAS: `npx eas-cli@latest credentials` → Android → Push Notifications (FCM V1). Then finish docs/NOTIFICATIONS.md (Vault secrets and the `send-notifications` function).

## Builds

| Profile | Command | What you get | Use it for |
|---|---|---|---|
| `development` | `npx eas-cli@latest build -p android --profile development` | An APK containing the dev menu; it connects to `npm start` | Your own phone while developing. Push notifications work here, unlike Expo Go. |
| `preview` | `npx eas-cli@latest build -p android --profile preview` | A normal APK with an install link | **The quickest way to reach 10–20 friends.** Share the link, and they allow "install from this source" once. |
| `production` | `npx eas-cli@latest build -p android --profile production` | An AAB for Google Play | The Play internal testing track (below) |

## Google Play internal testing (optional for the beta)

1. Create the app in Play Console. Google needs a one-time developer account fee, so check it's worth it for your beta.
2. Upload the **first** production AAB by hand: Testing → Internal testing → Create release.
3. Add testers by email, then share the opt-in link.
4. For later builds, run `npx eas-cli@latest submit -p android --profile production`. This uses a Google service account key, which EAS asks for the first time. Builds go to the internal track as drafts.
5. Play needs a **privacy policy URL** and the **Data safety** form before any public release. The in-app policy is still a draft (see docs/SECURITY_REVIEW.md and PRODUCT.md "Before public launch").

## Before each tester build

- Run `npm run check` locally; CI must be green on `main`.
- Run `supabase db push` and deploy any changed Edge Functions.
- Bump the version in `app.json` for release notes. The build number (`versionCode`) increases on its own (`appVersionSource: remote`).
