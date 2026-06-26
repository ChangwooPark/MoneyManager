# MoneyManager — 일본 생활비 관리 서비스

> **[English](./README.en.md)** · **[日本語](./README.ja.md)**

AI(Claude)를 개발 파트너로 활용하여 기획부터 운영까지 단독으로 설계·배포한 풀스택 가계부 웹 서비스입니다.

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| 🔐 PIN 인증 | 4자리 PIN으로 접근 제어 — 권한 보유자끼리 데이터 공유 가능 |
| 📝 거래 입력 | 수입·지출 등록 / 수정 / 삭제, 카테고리·메모 지원 |
| 🏠 홈 탭 | 월별 거래 목록, 날짜별 소계·순수익 표시 |
| 📅 달력 탭 | 월간 달력에 수입·지출 시각화, 날짜 클릭 시 상세 내역 |
| 📊 통계 탭 | 카테고리별 지출·수입 비중, 예산 대비 지출 진행률 |
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

`main` 브랜치에 푸시하면 GitHub Actions가 자동으로 빌드 및 배포합니다.

```
git push origin main
→ 백엔드: Docker 빌드 → Artifact Registry → Cloud Run 배포
→ 프론트엔드: Vercel 자동 배포
```

---

## LINE 알림 설정

파트너 추가 시 LINE Developers 콘솔에서 Webhook URL을 아래와 같이 설정합니다.

```
https://{BACKEND_URL}/notifications/line-webhook
```

파트너가 봇을 친구 추가 후 아무 메시지를 전송하면 자동으로 수신자 등록 및 User ID가 회신됩니다.
