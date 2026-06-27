# MoneyManager — Household Budget App for Life in Japan

> **[한국어](./README.md)** · **[日本語](./README.ja.md)**

A full-stack household budget web service — designed, built, and deployed solo using Claude AI as a development partner, from concept to production.

---

## Features

| Feature | Description |
|---------|-------------|
| 🔐 PIN Auth | 4-digit PIN access control — shared data across authorized users |
| 📝 Transactions | Add / edit / delete income & expense entries with category and memo |
| 🏠 Home Tab | Monthly transaction list grouped by date, with daily subtotals and net balance |
| 📅 Calendar Tab | Monthly calendar with income/expense visualization; tap a date for details |
| 📊 Stats Tab | Category-based spending/income breakdown with budget progress bar |
| ⚙️ More Tab | PIN change, monthly budget setting, category management, LINE notification settings |
| 🔔 LINE Alerts | Real-time LINE Messaging API notifications on transaction entry (Multicast support, partner auto-registration via Webhook) |
| 🗑️ Data Reset | Full transaction delete after PIN re-authentication (2-step confirmation) |

---

## Tech Stack

**Frontend**
- Next.js 15 (App Router) · TypeScript · Tailwind CSS
- Deployed on Vercel

**Backend**
- Node.js · Express · TypeScript
- Deployed on Google Cloud Run (Seoul region)

**Database & Infrastructure**
- Google Cloud Firestore (Native Mode)
- Artifact Registry · Secret Manager · IAM

**Dev Tools**
- Playwright (454 E2E tests)
- GitHub Actions (CI/CD auto-deploy)

---

## Architecture

```
Browser / Mobile
     │
     ▼
Next.js Frontend (Vercel)
     │  REST API
     ▼
Express Backend (Cloud Run)
     │
     ▼
Firestore          LINE Messaging API
```

---

## Local Development

```bash
# Backend (MoneyManager/ root)
gcloud auth application-default login
npm install
npm run dev          # → http://localhost:8080

# Frontend (MoneyManager/frontend/)
npm install
npm run dev          # → http://localhost:3000
```

---

## Deployment

Pushing to the `main` branch triggers automatic build and deploy via GitHub Actions.

```
git push origin main
→ Backend:  Docker build → Artifact Registry → Cloud Run deploy
→ Frontend: Vercel auto-deploy
```

---

## LINE Notification Setup

When a transaction is saved, both you and your partner receive a LINE notification simultaneously.

### Initial Setup (admin, one-time)

**① Enable Webhook in LINE Developers Console**

https://developers.line.biz → Channel → **Messaging API** tab

| Field | Value |
|-------|-------|
| Webhook URL | `https://money-manager-1094294666571.asia-northeast3.run.app/notifications/line-webhook` |
| Use webhook | **ON** |

Enter the URL and click **Verify** → confirm `"Success"`

**② Disable auto-reply in LINE Official Account Manager**

https://manager.line.biz → Channel → **Response settings**

| Field | Value |
|-------|-------|
| Response mode | **Bot** |
| Auto-reply messages | **OFF** |

> If auto-reply is not disabled, LINE's default message (`このアカウントでは個別のお問い合わせ...`) is sent instead of the Webhook response, and partner registration will not work.

---

### Adding a Partner (partner does this themselves)

No LINE developer account is needed — just a regular LINE app.

1. Share the bot's **QR code** or **bot ID (starting with @)** from LINE Developers Console → Messaging API tab
2. Partner **adds the bot as a friend** in the LINE app
3. Partner **sends any message** to the bot (e.g. "register me")
4. Bot automatically replies:
   ```
   ✅ You have been registered as a notification recipient!
   User ID: Uxxxxxxxxxxxxxxxxx
   ```
5. In the app → **More** → **LINE Alerts** section, confirm 2 recipients are listed

After registration, both users receive a notification every time a transaction is saved.
