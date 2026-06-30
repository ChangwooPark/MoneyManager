# MoneyManager — Household Budget App for Life in Japan

> **[한국어](./README.md)** · **[日本語](./README.ja.md)**

A full-stack household budget web service — designed, built, and deployed solo using Claude AI as a development partner, from concept to production.

---

## Features

| Feature | Description |
|---------|-------------|
| 🔐 PIN Auth | 4-digit PIN access control — shared data across authorized users |
| 📝 Transactions | Add / edit / delete income & expense entries with category and memo |
| 🏠 Home Tab | Monthly transaction list grouped by date, daily subtotals and net balance; tap any entry for details/edit/delete |
| 📅 Calendar Tab | Monthly calendar with income/expense visualization; tap a date for full breakdown and edit/delete support |
| 📊 Stats Tab | Category-based spending/income breakdown with budget progress bar; tap any entry for details/edit/delete |
| ⚙️ More Tab | PIN change, monthly budget setting, category management, language settings, LINE notification settings |
| 🌐 Multilingual | Instant Korean ↔ Japanese switching; language preference saved in Firestore (persists across sessions) |
| 📷 Receipt Scan | Photo a receipt during transaction entry → Claude Vision AI auto-fills amount and memo |
| 🔔 LINE Alerts | Real-time LINE Messaging API notifications on transaction entry (Multicast support, partner auto-registration via Webhook) |
| 🗑️ Data Reset | Full transaction delete after PIN re-authentication (2-step confirmation to prevent mistakes) |

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
- Playwright (E2E tests)
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

## Environment Setup

Production and Development environments are fully isolated.

| Item | Production | Development |
|------|-----------|-------------|
| GitHub Branch | `main` | `develop` |
| GCP Project | `money-manager-499703` | `money-manager-dev-001` |
| Cloud Run | `money-manager` | `money-manager-dev` |
| Firestore | Production DB | Dev DB (fully isolated) |
| Frontend URL | `frontend-changwoo-park.vercel.app` | `frontend-dev-changwoo-park.vercel.app` |

```
push to develop → GitHub Actions → auto-deploy to dev server → verify
create PR (develop → main) and merge → GitHub Actions → auto-deploy to production
```

> **`main` branch protection**: Direct pushes are blocked. Changes must go through a PR from `develop`.

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

Development is verified first, then promoted to production via PR.

```
# Step 1: Deploy to development and verify
git push origin develop
→ Backend:  Docker build → Artifact Registry(dev) → Cloud Run(money-manager-dev)
→ Frontend: Vercel dev fixed URL (frontend-dev-changwoo-park.vercel.app)

# Step 2: After verification, deploy to production
gh pr create --base main --head develop  # create PR
gh pr merge <PR#> --merge               # merge → triggers production deploy
→ Backend:  Docker build → Artifact Registry → Cloud Run(money-manager)
→ Frontend: Vercel production URL (frontend-changwoo-park.vercel.app)
```

---

## LINE Notification Setup

When a transaction is saved, both you and your partner receive a LINE notification simultaneously.

For the full setup guide including partner registration steps, see:

→ [Documents/JP/27-line-partner-setup.md](./Documents/JP/27-line-partner-setup.md)
