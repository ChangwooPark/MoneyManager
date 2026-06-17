# Phase 3: GCP 인프라 구성

## 활성화한 GCP API

GCP의 각 서비스를 사용하려면 API를 먼저 활성화해야 합니다.

```bash
gcloud services enable \
  firestore.googleapis.com \        # Firestore 데이터베이스
  artifactregistry.googleapis.com \ # Docker 이미지 저장소
  cloudbuild.googleapis.com \       # 클라우드 빌드
  run.googleapis.com                # Cloud Run 서비스
```

## Firestore 데이터베이스

### 생성 명령어

```bash
gcloud firestore databases create \
  --location=asia-northeast3 \  # 서울 리전
  --project=money-manager-499703
```

### Firestore란?

Google이 제공하는 **NoSQL 문서형 데이터베이스**입니다.

**구조:**
```
Firestore
  └─ Collection (컬렉션) = 폴더 개념
       └─ Document (문서) = 파일 개념
            └─ Field (필드) = 데이터
```

**이 프로젝트의 구조:**
```
transactions (컬렉션)
  ├─ 3FymF3vJSd03Tjyhicdb (문서 ID - 자동 생성)
  │    ├─ type: "expense"
  │    ├─ amount: 5000
  │    ├─ category: "식비"
  │    ├─ description: "점심 식사"
  │    ├─ date: "2026-06-17"
  │    └─ createdAt: Timestamp
  └─ ...
```

### Native Mode란?

Firestore에는 두 가지 모드가 있습니다:
- **Native Mode**: 실시간 업데이트, 강력한 쿼리 지원 → 우리가 선택
- **Datastore Mode**: 기존 Datastore와 호환 (레거시)

### 무료 티어

| 항목 | 무료 한도 |
|------|----------|
| 저장 용량 | 1GB |
| 읽기 | 50,000회/일 |
| 쓰기 | 20,000회/일 |
| 삭제 | 20,000회/일 |

개인 가계부 수준에서는 무료 한도를 초과하기 어렵습니다.

## Artifact Registry

Docker 이미지를 저장하는 창고입니다. GitHub에서 코드를 저장하듯, Docker 이미지를 저장합니다.

### 생성 명령어

```bash
gcloud artifacts repositories create money-manager \
  --repository-format=docker \   # Docker 이미지 형식
  --location=asia-northeast3 \   # 서울 리전
  --project=money-manager-499703
```

### 이미지 경로 규칙

```
asia-northeast3-docker.pkg.dev / money-manager-499703 / money-manager / account-book : v1
        리전                           프로젝트 ID          저장소 이름      이미지 이름   태그
```

## 리전 선택 이유 (asia-northeast3)

모든 서비스를 **서울 리전(asia-northeast3)** 에 배포한 이유:
1. 한국 사용자 기준 지연 시간 최소화
2. Firestore ↔ Cloud Run 간 같은 리전이면 네트워크 비용 없음
3. 데이터 주권 (한국 내 데이터 보관)
