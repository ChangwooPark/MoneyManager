# Vercel 배포

## Vercel이란?

Vercel은 Next.js를 만든 회사가 운영하는 **프론트엔드 전용 클라우드 플랫폼**입니다.
Next.js 앱을 가장 쉽고 빠르게 배포할 수 있는 공식 플랫폼입니다.

```
개발자가 할 일: git push 한 번
Vercel이 알아서 하는 것:
  - 코드 감지
  - npm install
  - next build
  - 전 세계 CDN에 배포
  - HTTPS URL 발급
```

---

## Vercel vs Cloud Run 비교

| 항목 | Vercel | Cloud Run |
|------|--------|-----------|
| 용도 | 프론트엔드 (Next.js 특화) | 백엔드/프론트엔드 모두 가능 |
| 설정 난이도 | 매우 쉬움 | 보통 (Dockerfile 필요) |
| Next.js 최적화 | 완벽 지원 | 직접 설정 필요 |
| 무료 티어 | 넉넉함 (개인 프로젝트 충분) | 제한적 |
| 자동 배포 | GitHub 연동 시 push만으로 | GitHub Actions 필요 |
| CDN | 전 세계 자동 적용 | 리전 선택 필요 |

이 프로젝트에서 **프론트엔드는 Vercel**, **백엔드는 Cloud Run**으로 역할을 나눴습니다.

---

## 프로젝트 구성

```
GitHub (ChangwooPark/MoneyManager)
  │
  ├─ MoneyManager/          → Cloud Run (백엔드 Express API)
  │    └─ src/
  │
  └─ MoneyManager/frontend/ → Vercel (프론트엔드 Next.js)
       └─ src/
```

Vercel은 GitHub 저장소의 `MoneyManager/frontend/` 폴더만 바라보고 빌드합니다.

---

## 배포 과정

### 1. Vercel CLI 설치

```bash
npm install -g vercel
```

### 2. Vercel 로그인

```bash
vercel login
# 브라우저에서 Google 또는 GitHub 계정으로 인증
```

### 3. 최초 배포

```bash
cd MoneyManager/frontend
vercel --yes
# Next.js 자동 감지 → 빌드 → 배포
# 배포 URL 발급: https://frontend-dusky-tau-46.vercel.app
```

### 4. 환경 변수 등록

프론트엔드가 백엔드 API URL을 알아야 하므로 Vercel에 환경 변수를 등록합니다.

```bash
vercel env add NEXT_PUBLIC_API_URL production
# 값 입력: https://money-manager-1094294666571.asia-northeast3.run.app
```

### 5. Cloud Run 백엔드 CORS 설정

백엔드가 Vercel 도메인에서 오는 요청을 허용하도록 설정합니다.

```bash
gcloud run services update money-manager \
  --region=asia-northeast3 \
  --set-env-vars="FRONTEND_URL=https://frontend-dusky-tau-46.vercel.app" \
  --project=money-manager-499703
```

### 6. 환경 변수 반영을 위한 재배포

```bash
vercel --prod --yes
```

---

## CORS 설정이 필요한 이유

브라우저는 **다른 도메인**으로 API 요청을 보낼 때 보안 검사를 합니다.

```
Vercel (frontend-dusky-tau-46.vercel.app)
  → Cloud Run (money-manager-....run.app) 로 API 요청

브라우저: "다른 도메인이네? 서버가 허용했는지 확인할게"
Cloud Run: "FRONTEND_URL에 등록된 도메인이면 허용"
```

백엔드 코드에서 허용 도메인을 관리합니다:

```typescript
// src/index.ts
const allowedOrigins = [
  process.env.FRONTEND_URL,    // Vercel 배포 URL (환경 변수로 주입)
  'http://localhost:3000',     // 로컬 개발 환경
].filter(Boolean) as string[];
```

---

## 배포 URL 정보

| 항목 | URL |
|------|-----|
| Vercel 프론트엔드 | `https://frontend-dusky-tau-46.vercel.app` |
| Cloud Run 백엔드 | `https://money-manager-1094294666571.asia-northeast3.run.app` |

---

## 자동 배포 동작 방식

GitHub 저장소에 push하면 Vercel이 자동으로 변경 사항을 감지하고 재배포합니다.

```
로컬에서 코드 수정
  ↓
git push origin main
  ↓
Vercel: "frontend/ 폴더에 변경 감지"
  ↓
자동 빌드 & 배포 (약 1~2분)
  ↓
https://frontend-dusky-tau-46.vercel.app 에 반영
```

> **참고:** Cloud Run 백엔드도 같은 push로 GitHub Actions가 자동 배포합니다.
> main 브랜치 push 한 번으로 프론트엔드와 백엔드가 동시에 업데이트됩니다.

---

## 이후 개발 흐름

Phase 9~13 작업을 할 때마다:

```bash
git add .
git commit -m "작업 내용"
git push origin main
# → Vercel 자동 배포 → 핸드폰으로 즉시 확인 가능
```

Vercel 배포 현황은 [vercel.com/dashboard](https://vercel.com/dashboard) 에서 확인할 수 있습니다.

---

## CDN이란?

Vercel은 배포 시 전 세계 **CDN(Content Delivery Network)** 에 자동으로 파일을 올립니다.

```
CDN 없음:
  한국 사용자 → 미국 서버 요청 → 느림 (100~200ms)

CDN 있음 (Vercel):
  한국 사용자 → 가장 가까운 서버(예: 도쿄) → 빠름 (10~30ms)
```

Vercel은 전 세계 100개 이상의 엣지 서버를 운영하므로
어디서 접속해도 빠르게 로딩됩니다.
