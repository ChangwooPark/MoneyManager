# MoneyManager — 일본 생활비 관리 서비스

> **[English](./README.en.md)** · **[日本語](./README.ja.md)**

AI(Claude)를 개발 파트너로 활용하여 기획부터 운영까지 단독으로 설계·배포한 풀스택 가계부 웹 서비스입니다.

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| 🔐 PIN 인증 | 4자리 PIN으로 접근 제어 — 권한 보유자끼리 데이터 공유 가능 |
| 📝 거래 입력 | 수입·지출 등록 / 수정 / 삭제, 카테고리·메모 지원 |
| 🏠 홈 탭 | 월별 거래 목록, 날짜별 소계·순수익, 거래 클릭 시 상세/수정/삭제 |
| 📅 달력 탭 | 월간 달력에 수입·지출 시각화, 날짜 클릭 시 상세 내역 및 거래 수정/삭제 |
| 📊 통계 탭 | 카테고리별 지출·수입 비중, 예산 대비 지출 진행률, 거래 클릭 시 상세/수정/삭제 |
| ⚙️ 더보기 탭 | PIN 변경, 예산 설정, 카테고리 관리, LINE 알림 설정 |
| 🔔 LINE 알림 | 거래 등록 시 LINE Messaging API로 공동 수신자에게 실시간 알림 (Multicast 지원, Webhook으로 파트너 자동 등록) |
| 🗑️ 데이터 초기화 | PIN 재인증 후 전체 거래 내역 삭제 (2단계 인증으로 실수 방지) |

---

## 기술 스택

**프론트엔드**
- Next.js 15 (App Router) · TypeScript · Tailwind CSS
- Vercel 배포

**백엔드**
- Node.js · Express · TypeScript
- Google Cloud Run 배포 (서울 리전)

**데이터베이스 · 인프라**
- Google Cloud Firestore (Native Mode)
- Artifact Registry · Secret Manager · IAM

**개발 도구**
- Playwright (E2E 테스트 454건)
- GitHub Actions (CI/CD 자동 배포)

---

## 시스템 구조

```
브라우저 / 모바일
     │
     ▼
Next.js 프론트엔드 (Vercel)
     │  REST API
     ▼
Express 백엔드 (Cloud Run)
     │
     ▼
Firestore          LINE Messaging API
```

---

## 개발 환경 구성

운영(Production)과 개발(Development) 환경이 완전히 분리되어 있습니다.

| 항목 | 운영 | 개발 |
|------|------|------|
| GitHub 브랜치 | `main` | `develop` |
| GCP 프로젝트 | `money-manager-499703` | `money-manager-dev-001` |
| Cloud Run | `money-manager` | `money-manager-dev` |
| Firestore | 운영 DB | 개발 DB (완전 분리) |
| 프론트엔드 URL | `frontend-changwoo-park.vercel.app` | `frontend-dev-changwoo-park.vercel.app` |

```
develop 브랜치 push → GitHub Actions → 개발 서버 자동 배포 → 확인
develop → main PR 생성 및 머지 → GitHub Actions → 운영 서버 자동 배포
```

> **`main` 브랜치 보호 규칙**: 직접 push 불가. `develop` 브랜치에서 PR을 통해서만 반영됩니다.

---

## 로컬 실행

```bash
# 백엔드 (MoneyManager/ 루트)
gcloud auth application-default login
npm install
npm run dev          # → http://localhost:8080

# 프론트엔드 (MoneyManager/frontend/)
npm install
npm run dev          # → http://localhost:3000
```

---

## 배포

개발 확인 후 PR을 통해 운영에 반영하는 흐름으로 운영됩니다.

```
# 1단계: 개발 환경 배포 및 확인
git push origin develop
→ 백엔드: Docker 빌드 → Artifact Registry(dev) → Cloud Run(money-manager-dev)
→ 프론트엔드: Vercel 개발 고정 URL (frontend-dev-changwoo-park.vercel.app)

# 2단계: 개발 서버에서 확인 완료 후 운영 반영
gh pr create --base main --head develop  # PR 생성
gh pr merge <PR번호> --merge             # PR 머지 → 운영 자동 배포
→ 백엔드: Docker 빌드 → Artifact Registry → Cloud Run(money-manager)
→ 프론트엔드: Vercel Production URL (frontend-changwoo-park.vercel.app)
```

---

## LINE 알림 설정

거래 등록 시 본인 및 파트너에게 동시에 LINE 알림을 발송합니다.

파트너 추가 방법을 포함한 상세 설정 가이드는 아래 문서를 참고하세요.

→ [Documents/KR/27-line-partner-setup.md](./Documents/KR/27-line-partner-setup.md)
