# Phase Dev-4 — GitHub Actions 워크플로우 분리 학습 문서

## 개요

하나의 `deploy.yml`을 `deploy-prod.yml`(운영)과 `deploy-dev.yml`(개발)로 분리한 과정을 설명합니다.

---

## 1. GitHub Actions란?

GitHub 저장소에 특정 이벤트(push, PR 등)가 발생했을 때 자동으로 실행되는 스크립트입니다.
`.github/workflows/` 폴더 안의 YAML 파일로 정의합니다.

```
개발자가 git push
  → GitHub이 이벤트 감지
  → .github/workflows/*.yml 파일 확인
  → 조건에 맞는 워크플로우 자동 실행
  → 빌드 → 푸시 → 배포
```

---

## 2. 분리 전/후 구조

**분리 전**
```
.github/workflows/
  deploy.yml        ← main 브랜치만 처리
```

**분리 후**
```
.github/workflows/
  deploy-prod.yml   ← main 브랜치 → 운영 서버
  deploy-dev.yml    ← develop 브랜치 → 개발 서버
```

---

## 3. 두 파일의 차이점

### 트리거 브랜치

```yaml
# deploy-prod.yml
on:
  push:
    branches:
      - main      # main에 push될 때만 실행

# deploy-dev.yml
on:
  push:
    branches:
      - develop   # develop에 push될 때만 실행
```

### GCP 인증 (Secrets)

```yaml
# deploy-prod.yml — 운영 프로젝트 SA 키
credentials_json: ${{ secrets.GCP_SA_KEY }}

# deploy-dev.yml — 개발 프로젝트 SA 키
credentials_json: ${{ secrets.GCP_DEV_SA_KEY }}
```

`${{ secrets.이름 }}` 은 GitHub Secrets에 저장된 민감한 값을 꺼내는 문법입니다.
실제 키 값이 워크플로우 코드에 노출되지 않습니다.

### Docker 이미지 경로

```yaml
# deploy-prod.yml
IMAGE=asia-northeast3-docker.pkg.dev/${{ secrets.GCP_PROJECT_ID }}/money-manager/account-book:${{ github.sha }}

# deploy-dev.yml
IMAGE=asia-northeast3-docker.pkg.dev/${{ secrets.GCP_DEV_PROJECT_ID }}/money-manager-dev/account-book:${{ github.sha }}
```

`${{ github.sha }}` 는 현재 커밋의 고유 해시값(예: `a1b2c3d...`)입니다.
이미지에 커밋 해시를 태그로 붙이면 **어떤 코드로 빌드된 이미지인지 추적**할 수 있습니다.

### Cloud Run 배포 대상

```yaml
# deploy-prod.yml
gcloud run deploy money-manager      # 운영 서비스

# deploy-dev.yml
gcloud run deploy money-manager-dev  # 개발 서비스
```

### Vercel 배포 방식

```yaml
# deploy-prod.yml — 운영 URL에 고정 반영
vercel build --prod
vercel deploy --prebuilt --prod

# deploy-dev.yml — 개발 고정 URL에 반영 (Dev-5에서 설정)
vercel build
vercel deploy --prebuilt
```

### 백엔드 URL 주입

```yaml
# deploy-prod.yml
NEXT_PUBLIC_API_URL: https://money-manager-1094294666571.asia-northeast3.run.app

# deploy-dev.yml
NEXT_PUBLIC_API_URL: https://money-manager-dev-576447610294.asia-northeast3.run.app
```

프론트엔드는 빌드 시점에 백엔드 URL이 코드 안에 번들(포함)됩니다.
환경에 따라 다른 URL을 주입해야 각자의 백엔드와 통신합니다.

---

## 4. 전체 워크플로우 흐름도

```
develop 브랜치에 git push
  │
  ├─ deploy-dev.yml 실행
  │    ├─ GCP 개발 계정으로 인증 (GCP_DEV_SA_KEY)
  │    ├─ Docker 이미지 빌드 → 개발 Artifact Registry 푸시
  │    ├─ 개발 Cloud Run (money-manager-dev) 배포
  │    └─ Vercel 개발 URL로 프론트엔드 배포
  │
  └─ deploy-prod.yml → 실행 안 됨 (main만 트리거)

main 브랜치에 git push
  │
  ├─ deploy-prod.yml 실행
  │    ├─ GCP 운영 계정으로 인증 (GCP_SA_KEY)
  │    ├─ Docker 이미지 빌드 → 운영 Artifact Registry 푸시
  │    ├─ 운영 Cloud Run (money-manager) 배포
  │    └─ Vercel 운영 URL로 프론트엔드 배포
  │
  └─ deploy-dev.yml → 실행 안 됨 (develop만 트리거)
```

---

## 5. 핵심 개념 정리

| 개념 | 설명 |
|------|------|
| GitHub Actions | push·PR 등의 이벤트에 반응해 자동으로 실행되는 CI/CD 자동화 도구 |
| 워크플로우(Workflow) | `.github/workflows/*.yml`로 정의하는 자동화 작업 단위 |
| `on.push.branches` | 어느 브랜치에 push될 때 워크플로우를 실행할지 지정하는 트리거 |
| `secrets.이름` | GitHub Secrets에 저장된 민감한 값을 참조하는 문법 (코드에 노출 안 됨) |
| `github.sha` | 현재 커밋의 고유 해시값. 이미지 태그로 사용하면 배포 추적 가능 |
| `NEXT_PUBLIC_API_URL` | 프론트엔드 빌드 시 백엔드 URL을 주입하는 환경변수 |
