# 개발 워크플로우

## 일상적인 개발 사이클

```
1. 로컬에서 코드 수정
2. 로컬 서버로 동작 확인
3. git commit & push
4. GitHub Actions가 자동 배포
5. 서비스 URL에서 최종 확인
```

---

## 로컬 개발 환경 준비 (최초 1회)

### 백엔드 의존성 설치

```bash
# MoneyManager/ 폴더에서
npm install
```

### 프론트엔드 의존성 설치

```bash
# MoneyManager/frontend/ 폴더에서
npm install
```

### GCP 로컬 인증

백엔드가 로컬에서 Firestore에 접근하려면 GCP 인증이 필요합니다.
**최초 1회만 실행하면 됩니다.**

```bash
gcloud auth application-default login
# → 브라우저가 열리며 Google 계정으로 로그인
```

---

## 로컬 서버 실행

프론트엔드와 백엔드를 **각각 별도 터미널**에서 실행해야 합니다.

### 터미널 1 — 백엔드 (Express)

```bash
# MoneyManager/ 폴더에서
npm run dev
# → http://localhost:8080 에서 실행
```

### 터미널 2 — 프론트엔드 (Next.js)

```bash
# MoneyManager/frontend/ 폴더에서
npm run dev
# → http://localhost:3000 에서 실행
```

브라우저에서 `http://localhost:3000` 에 접속하면 PIN 화면이 표시됩니다.

---

## 로컬 서버 종료

각 터미널에서 아래 단축키를 누릅니다:

```
Ctrl + C
```

| 터미널 | 종료 방법 |
|--------|---------|
| 백엔드 터미널 | `Ctrl + C` |
| 프론트엔드 터미널 | `Ctrl + C` |

### 종료 확인 방법

```bash
# 8080 포트(백엔드)가 비어있는지 확인
lsof -i :8080

# 3000 포트(프론트엔드)가 비어있는지 확인
lsof -i :3000
# → 아무것도 출력되지 않으면 정상 종료된 것
```

### 포트가 점유된 채로 남아있을 때

`Ctrl+C`가 제대로 안 먹혔다면 아래 명령어로 강제 종료합니다:

```bash
# 8080 포트 강제 종료
lsof -ti :8080 | xargs kill -9

# 3000 포트 강제 종료
lsof -ti :3000 | xargs kill -9
```

---

## 로컬 연결 구조

```
브라우저 (http://localhost:3000)
  ↓ API 요청
Next.js 프론트엔드 (localhost:3000)
  ↓ HTTP fetch
Express 백엔드 (localhost:8080)
  ↓ SDK 접근
Firestore (실제 GCP — asia-northeast3)
```

로컬에서도 실제 GCP Firestore에 연결됩니다.
로컬에서 데이터를 수정하면 실제 DB에 반영됩니다.

---

## 새 기능 개발 예시

### 예시: 월별 합계 API 추가

**1. 브랜치 생성**
```bash
git checkout -b feature/monthly-summary
```

**2. 코드 수정**
`src/routes/transactions.ts` 또는 `src/services/firestore.ts` 수정

**3. 로컬 확인**
```bash
# 백엔드 실행 후
curl http://localhost:8080/transactions?yearMonth=2026-06
```

**4. 커밋 & 푸시**
```bash
git add .
git commit -m "Add monthly summary API"
git push origin feature/monthly-summary
# → 이 시점에서는 배포 안 됨
```

**5. main에 병합 → 자동 배포**
```bash
git checkout main
git merge feature/monthly-summary
git push origin main
# → GitHub Actions 자동 실행 → Cloud Run 배포
```

---

## API 사용 예시 (배포된 서버)

### 거래 내역 생성

```bash
curl -X POST https://money-manager-1094294666571.asia-northeast3.run.app/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "type": "expense",
    "amount": 12000,
    "category": "식비",
    "description": "저녁 식사",
    "date": "2026-06-17"
  }'
```

### 특정 월 내역 조회

```bash
curl https://money-manager-1094294666571.asia-northeast3.run.app/transactions?yearMonth=2026-06
```

### 내역 수정

```bash
curl -X PUT https://money-manager-1094294666571.asia-northeast3.run.app/transactions/{id} \
  -H "Content-Type: application/json" \
  -d '{"amount": 15000}'
```

### 내역 삭제

```bash
curl -X DELETE https://money-manager-1094294666571.asia-northeast3.run.app/transactions/{id}
```

### PIN 검증

```bash
curl -X POST https://money-manager-1094294666571.asia-northeast3.run.app/settings/pin/verify \
  -H "Content-Type: application/json" \
  -d '{"pin": "8907"}'
```

### 예산 설정

```bash
curl -X PUT https://money-manager-1094294666571.asia-northeast3.run.app/budgets/2026-06 \
  -H "Content-Type: application/json" \
  -d '{"amount": 200000}'
```

---

## 유용한 명령어 모음

```bash
# GitHub Actions 실행 목록 확인
gh run list --repo ChangwooPark/MoneyManager

# Cloud Run 서비스 상태 확인
gcloud run services describe money-manager \
  --region=asia-northeast3 \
  --project=money-manager-499703

# Cloud Run 로그 확인
gcloud logging read "resource.type=cloud_run_revision" \
  --project=money-manager-499703 \
  --limit=50

# Artifact Registry 이미지 목록
gcloud artifacts docker images list \
  asia-northeast3-docker.pkg.dev/money-manager-499703/money-manager
```

---

## 문제 발생 시 확인 순서

```
1. PIN 오류가 날 때
   → 백엔드 서버가 실행 중인지 확인 (localhost:8080)
   → 터미널 1에서 npm run dev 실행 여부 확인

2. 화면이 안 뜰 때
   → 프론트엔드 서버가 실행 중인지 확인 (localhost:3000)
   → 터미널 2에서 npm run dev 실행 여부 확인

3. GitHub Actions 배포 실패 시
   → GitHub 저장소 → Actions 탭에서 로그 확인

4. 배포된 서버 오류 시
   → Cloud Run 로그 확인
   → /health 엔드포인트 응답 확인
```
