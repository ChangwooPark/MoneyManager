# Phase Dev-1/Dev-2 — 개발 환경 구축 학습 문서

## 개요

운영(Production)과 완전히 분리된 개발(Development) 환경을 GCP에 구축한 과정을 설명합니다.

**목표**: 새 기능을 개발 서버에서 검증한 뒤 운영으로 승격하는 안전한 워크플로우 확립

---

## 1. 왜 개발 환경을 분리하는가?

### 현재(분리 전) 문제점

```
기능 개발 코드
  → main 브랜치 push
  → 바로 운영 배포
  → 실제 데이터에 영향 가능
```

### 분리 후 목표 흐름

```
기능 개발
  → develop 브랜치 push
  → 개발 서버(dev) 자동 배포
  → 개발 DB로 테스트 및 수동 확인
  → 문제 없으면 main 브랜치로 PR
  → 운영(prod) 자동 배포
```

---

## 2. 환경 구성 비교

| 항목 | 운영(Production) | 개발(Development) |
|------|------|------|
| GitHub 브랜치 | `main` | `develop` |
| GCP 프로젝트 | `money-manager-499703` | `money-manager-dev-001` |
| Firestore DB | 운영 데이터 | 개발/테스트 데이터 (완전 분리) |
| Cloud Run | `money-manager` | `money-manager-dev` |
| Artifact Registry | `money-manager` | `money-manager-dev` |
| 백엔드 URL | `money-manager-1094294666571.asia-northeast3.run.app` | `money-manager-dev-576447610294.asia-northeast3.run.app` |

### 별도 GCP 프로젝트를 생성하는 이유

GCP 무료 티어(Firestore 읽기/쓰기 쿼터, Cloud Run 요청 수, Artifact Registry 저장 용량)는 **프로젝트 단위**로 적용됩니다.

같은 프로젝트 안에 두 번째 Firestore 데이터베이스를 만들면 유료로 청구되지만, 별도 GCP 프로젝트를 새로 만들면 각 프로젝트가 독립적인 무료 티어를 받으므로 **추가 비용 없이 완전한 환경 분리**가 가능합니다.

---

## 3. GCP 개발 프로젝트 생성 절차

### 3-1. 프로젝트 생성

```bash
# 새 GCP 프로젝트 생성 (전 세계에서 유일한 ID 필요)
gcloud projects create money-manager-dev-001 --name="MoneyManager Dev"
```

### 3-2. 결제 계정 연결

Cloud Run, Artifact Registry를 사용하려면 결제 계정이 연결되어야 합니다.
무료 티어 범위 내에서 운영하면 실제 청구는 발생하지 않습니다.

```bash
# 결제 계정 ID 확인
gcloud billing accounts list

# 프로젝트에 연결
gcloud billing projects link money-manager-dev-001 \
  --billing-account=<ACCOUNT_ID>
```

### 3-3. 필요한 API 활성화

```bash
gcloud services enable \
  run.googleapis.com \          # Cloud Run (백엔드 실행)
  firestore.googleapis.com \    # Firestore (데이터베이스)
  artifactregistry.googleapis.com \ # 도커 이미지 저장소
  secretmanager.googleapis.com \    # 시크릿(토큰, 키) 보관
  --project=money-manager-dev-001
```

---

## 4. Firestore 개발 데이터베이스 생성

```bash
gcloud firestore databases create \
  --location=asia-northeast3 \   # 서울 리전
  --project=money-manager-dev-001
```

생성 결과에서 `freeTier: true` 를 확인하면 무료 티어가 적용된 것입니다.

---

## 5. Artifact Registry 개발 저장소 생성

```bash
gcloud artifacts repositories create money-manager-dev \
  --repository-format=docker \
  --location=asia-northeast3 \
  --project=money-manager-dev-001
```

Docker 이미지를 저장하는 곳입니다. 운영(`money-manager`)과 별도로 개발용 저장소를 운영합니다.

---

## 6. GitHub Actions용 Service Account 구성

### 6-1. Service Account란?

사람이 아닌 **프로그램(GitHub Actions)**이 GCP 리소스에 접근할 때 사용하는 계정입니다.
"이 자동화 작업은 어디까지 할 수 있는가"를 역할(Role)로 제한합니다.

### 6-2. SA 생성 및 역할 부여

```bash
# SA 생성
gcloud iam service-accounts create github-actions-dev \
  --display-name="GitHub Actions Dev" \
  --project=money-manager-dev-001

# 필요한 역할 4개 부여 (운영 SA와 동일)
# roles/run.admin            → Cloud Run 서비스 배포 권한
# roles/artifactregistry.writer → 이미지 푸시 권한
# roles/iam.serviceAccountUser  → SA를 Cloud Run에 할당 권한
# roles/secretmanager.secretAccessor → 시크릿 읽기 권한
```

### 6-3. SA 키 발급 및 GitHub Secrets 등록

```bash
# JSON 키 파일 발급
gcloud iam service-accounts keys create /tmp/gcp-dev-sa-key.json \
  --iam-account=github-actions-dev@money-manager-dev-001.iam.gserviceaccount.com

# GitHub Secrets에 등록
gh secret set GCP_DEV_SA_KEY < /tmp/gcp-dev-sa-key.json
gh secret set GCP_DEV_PROJECT_ID --body="money-manager-dev-001"

# 로컬 키 파일 즉시 삭제 (보안)
rm /tmp/gcp-dev-sa-key.json
```

---

## 7. Secret Manager 구성

개발 환경에도 운영과 **동일한 이름**의 시크릿을 생성합니다.
값은 개발용으로 재발급한 토큰으로 교체해야 합니다.

```bash
for secret in LINE_CHANNEL_ACCESS_TOKEN LINE_USER_ID LINE_CHANNEL_SECRET; do
  echo -n "placeholder-dev" | gcloud secrets create "$secret" \
    --data-file=- \
    --project=money-manager-dev-001
done
```

> **주의**: 플레이스홀더 상태에서는 LINE 알림 기능이 동작하지 않습니다.
> 개발용 LINE 채널 토큰을 발급받은 후 아래 명령으로 교체하세요.
>
> ```bash
> echo -n "실제_토큰값" | gcloud secrets versions add LINE_CHANNEL_ACCESS_TOKEN \
>   --data-file=- \
>   --project=money-manager-dev-001
> ```

---

## 8. Cloud Run 개발 서비스 배포

### 8-1. 이미지 빌드 시 주의사항 — linux/amd64

Mac(M1/M2/M3)은 ARM 아키텍처이지만, Cloud Run은 **linux/amd64(Intel)** 이미지만 지원합니다.
`--platform=linux/amd64` 플래그를 반드시 지정해야 합니다.

```bash
# 잘못된 방법 (Mac에서 단순 빌드 → ARM 이미지 생성)
docker build -t <이미지경로> .  # ❌ Cloud Run에서 실행 불가

# 올바른 방법 (플랫폼 명시)
docker buildx build \
  --platform=linux/amd64 \
  --push \
  -t <이미지경로> .              # ✅
```

### 8-2. Cloud Run 배포

```bash
gcloud run deploy money-manager-dev \
  --image=asia-northeast3-docker.pkg.dev/money-manager-dev-001/money-manager-dev/account-book:latest \
  --region=asia-northeast3 \
  --project=money-manager-dev-001 \
  --allow-unauthenticated \
  --cpu=1 \
  --memory=512Mi \
  --max-instances=1 \          # 비용 통제 — 인스턴스 최대 1개
  --timeout=300 \
  --cpu-boost \                # 콜드스타트 속도 향상
  --set-env-vars="GCP_PROJECT_ID=money-manager-dev-001" \
  --set-secrets="LINE_CHANNEL_ACCESS_TOKEN=LINE_CHANNEL_ACCESS_TOKEN:latest,..."
```

### 8-3. Compute SA 권한 추가

Cloud Run 컨테이너가 Secret Manager에서 시크릿을 읽으려면
**Cloud Run의 기본 실행 계정**(Compute Service Account)에도 읽기 권한이 필요합니다.

```bash
# 기본 Compute SA 형식: {프로젝트번호}-compute@developer.gserviceaccount.com
gcloud projects add-iam-policy-binding money-manager-dev-001 \
  --member="serviceAccount:576447610294-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

> 이 권한 없이 배포하면 `Permission denied on secret` 오류가 발생합니다.

---

## 9. 헬스체크 확인

```bash
curl https://money-manager-dev-576447610294.asia-northeast3.run.app/health
# → {"status":"ok"}
```

---

## 10. 핵심 개념 정리

| 개념 | 설명 |
|------|------|
| GCP 프로젝트 | GCP 리소스(Cloud Run, Firestore 등)의 격리 단위. 프로젝트별로 무료 티어 적용 |
| Service Account | 사람이 아닌 프로그램(GitHub Actions, Cloud Run)이 GCP에 인증할 때 사용하는 계정 |
| IAM 역할(Role) | SA가 할 수 있는 작업의 범위를 정의. `roles/run.admin` = Cloud Run 배포 가능 |
| Secret Manager | API 키, 토큰 등 민감한 값을 코드 밖(GCP)에서 안전하게 보관하는 서비스 |
| Artifact Registry | Docker 이미지를 저장·관리하는 GCP의 프라이빗 컨테이너 저장소 |
| `linux/amd64` | Cloud Run이 지원하는 CPU 아키텍처. Mac(ARM)에서 빌드 시 반드시 명시 필요 |
