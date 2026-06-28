# Phase Dev-6 — 운영/개발 완전 분리 최종 검증 학습 문서

## 개요

Dev-1~5에서 구축한 운영/개발 분리 환경이 실제로 올바르게 격리되어 동작하는지 검증한 과정을 설명합니다.

---

## 1. 검증 항목 및 결과

| 항목 | 방법 | 결과 |
|------|------|------|
| 운영 백엔드 정상 동작 | `/health` 엔드포인트 응답 확인 | ✅ `{"status":"ok"}` |
| 개발 백엔드 정상 동작 | `/health` 엔드포인트 응답 확인 | ✅ `{"status":"ok"}` |
| 개발 DB 격리 | 개발 백엔드에 거래 추가 후 건수 변화 확인 | ✅ 개발 DB만 증가 |
| 운영 DB 무결성 | 개발 작업 후 운영 DB 건수 변화 확인 | ✅ 변화 없음 |
| 개발 자동 배포 | `develop` push → GitHub Actions 실행 | ✅ 정상 실행 |
| 운영 자동 배포 | PR merge → GitHub Actions 실행 | ✅ 정상 실행 |

---

## 2. DB 격리 검증 상세

### 검증 전 기준선 확인

```bash
# 운영 백엔드의 2026-06 거래 건수
curl "https://money-manager-1094294666571.asia-northeast3.run.app/transactions?yearMonth=2026-06"
# → 2건

# 개발 백엔드의 2026-06 거래 건수
curl "https://money-manager-dev-576447610294.asia-northeast3.run.app/transactions?yearMonth=2026-06"
# → 0건
```

### 개발 백엔드에 거래 추가

```bash
curl -X POST "https://money-manager-dev-576447610294.asia-northeast3.run.app/transactions" \
  -H "Content-Type: application/json" \
  -d '{"date":"2026-06-28","type":"expense","category":"검증","description":"Dev-6 격리 검증","amount":1}'
# → {"id":"Et6i3Se5ZjEO047iXf60", ...}
```

### 격리 확인

```bash
# 개발 DB: 1건으로 증가 ✅
curl ".../dev.../transactions?yearMonth=2026-06"  # → 1건

# 운영 DB: 여전히 2건 ✅ (개발 작업에 영향받지 않음)
curl ".../prod.../transactions?yearMonth=2026-06"  # → 2건
```

**두 Cloud Run 서비스가 각각 다른 GCP 프로젝트의 Firestore를 바라보기 때문에 완전히 분리됩니다.**

---

## 3. 격리가 보장되는 구조적 이유

```
개발 프론트 (frontend-dev-changwoo-park.vercel.app)
  │  NEXT_PUBLIC_API_URL = 개발 백엔드 URL
  ▼
개발 백엔드 (money-manager-dev, Cloud Run)
  │  GCP 프로젝트: money-manager-dev-001
  ▼
개발 Firestore (money-manager-dev-001 프로젝트)

──────────────────────────────────────────────

운영 프론트 (frontend-changwoo-park.vercel.app)
  │  NEXT_PUBLIC_API_URL = 운영 백엔드 URL
  ▼
운영 백엔드 (money-manager, Cloud Run)
  │  GCP 프로젝트: money-manager-499703
  ▼
운영 Firestore (money-manager-499703 프로젝트)
```

각 환경이 독립된 GCP 프로젝트를 사용하므로, 프로그래밍 실수로도 교차 접근이 불가능합니다.

---

## 4. E2E 테스트 URL 환경변수화

### 변경 전

```typescript
// playwright.config.ts
use: {
  baseURL: 'http://localhost:3000',  // 항상 로컬 서버만 가능
}
```

### 변경 후

```typescript
use: {
  baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
}

// PLAYWRIGHT_BASE_URL 지정 시 로컬 서버 자동 생략
webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : [...],
```

### 사용 방법

```bash
# 로컬 개발 서버 대상 (기존과 동일)
npx playwright test

# 개발 서버 대상
PLAYWRIGHT_BASE_URL=https://frontend-dev-changwoo-park.vercel.app npx playwright test

# 운영 서버 대상
PLAYWRIGHT_BASE_URL=https://frontend-changwoo-park.vercel.app npx playwright test
```

### 왜 환경변수화가 필요한가

E2E 테스트를 로컬 서버에서만 실행하면 **배포된 서버에서의 동작은 검증되지 않습니다.**
예를 들어 환경변수 누락, CORS 설정, 빌드 최적화 이슈 등은 배포 후에만 발견됩니다.
URL을 환경변수로 분리하면 같은 테스트 코드로 로컬·개발·운영 서버 모두 검증할 수 있습니다.

---

## 5. 핵심 개념 정리

| 개념 | 설명 |
|------|------|
| GCP 프로젝트 격리 | GCP 리소스(Firestore, Cloud Run 등)는 프로젝트 단위로 완전히 분리됨. 교차 접근 불가 |
| `NEXT_PUBLIC_API_URL` | 프론트엔드 빌드 시 백엔드 URL을 주입하는 환경변수. 빌드 결과물에 포함됨 |
| `PLAYWRIGHT_BASE_URL` | E2E 테스트 대상 URL을 지정하는 환경변수. 미설정 시 localhost 사용 |
| `webServer: undefined` | Playwright가 로컬 서버를 자동 실행하지 않도록 하는 설정. 외부 URL 테스트 시 사용 |
