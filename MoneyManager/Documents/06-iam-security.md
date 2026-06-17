# Phase 5: IAM 보안 설정

## IAM이란?

IAM(Identity and Access Management)은 GCP에서 **"누가 무엇을 할 수 있는지"** 를 관리하는 시스템입니다.

```
IAM = 출입 관리 시스템
  - 누가: 사람 또는 서비스 계정
  - 무엇을: 특정 GCP 서비스 (Firestore, Cloud Run 등)
  - 어떻게: 읽기, 쓰기, 삭제 등
```

## Service Account란?

사람이 Google 계정으로 GCP에 로그인하듯, **애플리케이션(컨테이너)도 GCP 내에서 자신을 증명하는 계정**이 필요합니다. 이것이 Service Account입니다.

```
사람           →  Google 계정 (pcwjapan@gmail.com)
Cloud Run 앱  →  Service Account (1094294666571-compute@developer.gserviceaccount.com)
```

Cloud Run은 배포 시 **기본 Compute Service Account**를 자동으로 할당합니다.

## 왜 권한 설정이 필요했나?

Cloud Run 컨테이너가 Firestore에 접근하려면 명시적으로 허가해야 합니다.

```
권한 설정 전:
  Cloud Run → Firestore 접근 시도
  GCP IAM: "이 Service Account는 Firestore 권한 없음" → 403 오류

권한 설정 후:
  Cloud Run → Firestore 접근 시도
  GCP IAM: "roles/datastore.user 역할 있음" → 정상 동작
```

## 실행한 명령어

```bash
gcloud projects add-iam-policy-binding money-manager-499703 \
  --member="serviceAccount:1094294666571-compute@developer.gserviceaccount.com" \
  --role="roles/datastore.user"
```

| 파라미터 | 의미 |
|---------|------|
| `money-manager-499703` | 권한을 부여할 GCP 프로젝트 |
| `--member` | 권한을 받을 대상 (Cloud Run의 Service Account) |
| `--role="roles/datastore.user"` | 부여할 역할 |

## roles/datastore.user란?

Firestore는 내부적으로 Google Cloud Datastore 기술 기반이라 권한 이름이 `datastore.user`입니다.

| 작업 | 허용 여부 |
|------|----------|
| 문서 읽기 | 허용 |
| 문서 쓰기 | 허용 |
| 문서 수정 | 허용 |
| 문서 삭제 | 허용 |
| DB 구조 변경 | 불가 (owner만 가능) |

## 전체 요청 흐름

```
사용자 HTTP 요청
  ↓
Cloud Run 컨테이너
  (Service Account 소지)
  ↓
GCP IAM 검증
  (roles/datastore.user 역할 확인)
  ↓
Firestore
  ↓
데이터 반환
  ↓
HTTP 응답
```

한 마디로: **Cloud Run 서버가 Firestore에 접근할 수 있는 출입증을 발급한 작업**입니다.

## GitHub Actions용 Service Account

자동 배포를 위해 별도의 Service Account도 생성했습니다.

```bash
# GitHub Actions 전용 Service Account 생성
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions" \
  --project=money-manager-499703

# 필요한 권한 부여
roles/run.admin              # Cloud Run 배포 권한
roles/storage.admin          # Cloud Build 소스 업로드 권한
roles/artifactregistry.writer # Docker 이미지 푸시 권한
roles/iam.serviceAccountUser # Service Account 사용 권한
```

이 Service Account의 키를 GitHub Secrets에 등록해서 GitHub Actions가 GCP에 접근할 수 있게 했습니다.
