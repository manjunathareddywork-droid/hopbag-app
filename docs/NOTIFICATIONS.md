# Hopbag notifications

## How it works

1. **Every event becomes a database row.** Status changes, new offers, chat messages, ratings, and ID or ticket reviews each create a row in `public.notifications`, through triggers in the `chat_notifications_ratings` migration.
2. **The app shows them.** The **Updates** screen lists them, and Supabase Realtime keeps it live. This works everywhere, including Expo Go.
3. **A push goes out within a minute.** Every minute, `pg_cron` calls the `send-notifications` Edge Function, but only when there's something new. The function:
   - claims a batch, so each notification is pushed at most once,
   - sends it through the Expo Push API,
   - forgets phones that Expo reports as no longer registered.
4. **The app registers each phone.** After sign-in it saves the phone's Expo push token (`register_push_token`), and on sign-out it removes it.

The wording is in two places, which must be kept in step:
- `src/i18n/en.ts` (`notifications.kinds`) for the app,
- `supabase/functions/_shared/notification-text.ts` for push messages.

A test checks that every kind has text in both.

## Push needs a real build, not Expo Go

Since Expo SDK 53, Expo Go can't receive remote push on Android. Push works in a development build or an EAS build (Phase 8). Until then, the Updates screen shows everything.

## Setup

### 1. Shared secret for the cron call

Create a random secret:

```
openssl rand -hex 32
```

Store it as a function secret:

```
supabase secrets set NOTIFICATIONS_CRON_SECRET=<the secret>
```

Then, in the Supabase dashboard → SQL editor, run this once with your own values. It stores the URL and secret in Vault, so the cron job can call the function:

```sql
select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
select vault.create_secret('<the same secret>', 'notifications_cron_secret');
```

Until both Vault secrets exist, the cron job does nothing. Notifications still show in the app.

### 2. Deploy the function

```
supabase functions deploy send-notifications
```

### 3. Expo project id and Android push credentials (when making the first build)

1. Run `npx eas-cli@latest init` to link the app to your Expo account. It adds `extra.eas.projectId` to `app.json`. The app finds the id automatically.
2. For Android, create a Firebase project. Upload its FCM V1 service account key to EAS under Credentials → Android → FCM V1. See https://docs.expo.dev/push-notifications/fcm-credentials/.
3. Build a development build (`npx eas-cli@latest build --profile development --platform android`) and install it. After sign-in, the phone asks for notification permission and registers.
