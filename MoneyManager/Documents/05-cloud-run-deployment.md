# Phase 4: Cloud Run 배포

## Cloud Run이란?

컨테이너(Docker 이미지)를 서버리스로 실행하는 GCP 서비스입니다.

**서버리스의 의미:**
- 서버를 직접 관리할 필요 없음
- 요청이 없을 때는 인스턴스가 0으로 줄어들어 비용 없음
- 요청이 오면 자동으로 인스턴스 생성 후 응답

## 배포 과정

### Step 1 - Docker 인증 설정

로컬 Docker가 GCP Artifact Registry에 이미지를 올릴 수 있도록 인증합니다.

```bash
gcloud auth configure-docker asia-northeast3-docker.pkg.dev
```

### Step 2 - Cloud Build로 이미지 빌드 & 푸시

```bash
gcloud builds submit \
  --tag asia-northeast3-docker.pkg.dev/money-manager-499703/money-manager/account-book:v1
```

**로컬 빌드와의 차이:**

| 항목 | 로컬 빌드 | Cloud Build |
|------|----------|-------------|
| 빌드 위치 | 내 컴퓨터 | GCP 서버 |
| 속도 | 인터넷 업로드 필요 | GCP 내부 네트워크 |
| 자동 푸시 | 별도 명령 필요 | 빌드 후 자동 푸시 |

### Step 3 - Cloud Run 배포

```bash
gcloud run deploy money-manager \
  --image=asia-northeast3-docker.pkg.dev/money-manager-499703/money-manager/account-book:v1 \
  --region=asia-northeast3 \
  --platform=managed \
  --allow-unauthenticated \
  --max-instances=1 \
  --port=8080 \
  --project=money-manager-499703
```

**주요 옵션 설명:**

| 옵션 | 값 | 의미 |
|------|------|------|
| `--platform=managed` | managed | GCP가 인프라 전체 관리 |
| `--allow-unauthenticated` | - | 인증 없이 누구나 접근 가능 |
| `--max-instances=1` | 1 | 최대 인스턴스 수 1개로 제한 |
| `--port=8080` | 8080 | 컨테이너가 리슨하는 포트 |

## max-instances=1이 중요한 이유

Cloud Run은 트래픽이 많아지면 자동으로 인스턴스를 늘립니다(오토스케일링).
인스턴스가 늘어날수록 비용도 늘어납니다.

```
max-instances=1 설정 없을 때:
  트래픽 급증 → 인스턴스 10개 → 예상치 못한 비용 발생

max-instances=1 설정 후:
  트래픽 급증 → 인스턴스 최대 1개 → 비용 예측 가능
```

개인 프로젝트이므로 1개로 충분하고, 비용 제어에 필수적입니다.

## 무료 티어

| 항목 | 무료 한도 (월) |
|------|--------------|
| 요청 수 | 200만 건 |
| CPU | 180,000 vCPU-초 |
| 메모리 | 360,000 GB-초 |

개인 가계부 수준에서는 무료 한도를 초과하기 어렵습니다.

## 배포 후 확인

```bash
# 헬스체크
curl https://money-manager-1094294666571.asia-northeast3.run.app/health
# → {"status":"ok"}

# 거래 내역 생성 테스트
curl -X POST https://money-manager-1094294666571.asia-northeast3.run.app/transactions \
  -H "Content-Type: application/json" \
  -d '{"type":"expense","amount":5000,"category":"식비","description":"점심","date":"2026-06-17"}'
```
