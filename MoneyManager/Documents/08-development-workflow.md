# 개발 워크플로우

## 일상적인 개발 사이클

```
1. 로컬에서 코드 수정
2. 로컬 서버로 동작 확인
3. git commit & push
4. GitHub Actions가 자동 배포
5. 서비스 URL에서 최종 확인
```

## 로컬 개발 환경 준비

처음 개발 환경 세팅 시 한 번만 실행합니다:

```bash
# 의존성 설치
npm install

# GCP 로컬 인증 (Firestore 로컬 연결용)
gcloud auth application-default login
```

## 로컬 서버 실행

```bash
npm run dev
# → http://localhost:8080 에서 서버 실행
```

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
npm run dev
curl http://localhost:8080/transactions/summary/2026-06
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

## 배포 없이 빠르게 확인하는 방법

로컬에서 Docker로도 확인할 수 있습니다:

```bash
docker build -t money-manager:local .
docker run -p 8080:8080 money-manager:local
curl http://localhost:8080/health
```

## API 사용 예시

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

### 전체 내역 조회

```bash
curl https://money-manager-1094294666571.asia-northeast3.run.app/transactions
```

### 특정 내역 조회

```bash
curl https://money-manager-1094294666571.asia-northeast3.run.app/transactions/{id}
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

## 문제 발생 시 확인 순서

```
1. GitHub Actions 탭에서 빌드 로그 확인
   → 빌드/배포 오류 여부

2. Cloud Run 로그 확인
   → 런타임 오류 여부

3. /health 엔드포인트 확인
   → 서버 생존 여부

4. Firestore 콘솔 확인
   → 데이터 저장 여부
```
