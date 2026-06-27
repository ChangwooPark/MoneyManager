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

거래 등록 시 본인 및 파트너에게 동시에 LINE 알림을 발송합니다.

### 초기 설정 (관리자 1회)

**① LINE Developers 콘솔에서 Webhook 활성화**

https://developers.line.biz → 채널 → **Messaging API** 탭

| 항목 | 값 |
|------|----|
| Webhook URL | `https://money-manager-1094294666571.asia-northeast3.run.app/notifications/line-webhook` |
| Use webhook | **ON** |

URL 입력 후 **Verify** 버튼 클릭 → `"Success"` 확인

**② LINE Official Account Manager에서 자동응답 끄기**

https://manager.line.biz → 해당 채널 → **응답 설정**

| 항목 | 값 |
|------|----|
| 응답 모드 | **Bot** |
| 자동응답 메시지 | **OFF** |

> 자동응답을 끄지 않으면 Webhook 대신 LINE 기본 메시지(`このアカウントでは個別のお問い合わせ...`)가 발송되어 파트너 등록이 동작하지 않습니다.

---

### 파트너 추가 방법 (파트너 본인이 직접)

파트너는 LINE 개발자 계정 없이 일반 LINE 앱만으로 등록 가능합니다.

1. LINE Developers 콘솔 → Messaging API 탭 → **QR 코드** 또는 **봇 ID(@로 시작)** 를 파트너에게 공유
2. 파트너가 LINE 앱으로 봇을 **친구 추가**
3. 파트너가 봇에게 **아무 메시지나 전송** (예: "등록해줘")
4. 봇이 자동으로 회신:
   ```
   ✅ 알림 수신자로 등록되었습니다!
   User ID: Uxxxxxxxxxxxxxxxxx
   ```
5. 앱 → **더보기** → **LINE 알림** 섹션에서 수신자 2명 확인

등록 이후 거래 내역이 저장될 때마다 두 사람 모두에게 알림이 발송됩니다.
