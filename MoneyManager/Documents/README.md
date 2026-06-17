# MoneyManager 문서

TypeScript + GCP 기반 가계부 프로젝트 전체 문서입니다.

## 백엔드 문서 (Express + Cloud Run)

| 파일 | 내용 |
|------|------|
| [01-architecture.md](./01-architecture.md) | 전체 시스템 구조, 기술 스택, API 목록 |
| [02-local-development.md](./02-local-development.md) | 로컬 개발 환경 구성, 파일 구조, 주요 코드 설명 |
| [03-docker.md](./03-docker.md) | Docker 개념, Dockerfile 설명, 멀티스테이지 빌드 |
| [04-gcp-infrastructure.md](./04-gcp-infrastructure.md) | Firestore, Artifact Registry 구성, GCP 무료 티어 |
| [05-cloud-run-deployment.md](./05-cloud-run-deployment.md) | Cloud Run 배포 방법, 비용 제어, 서버리스 개념 |
| [06-iam-security.md](./06-iam-security.md) | IAM 권한, Service Account, 보안 설정 |
| [07-github-actions.md](./07-github-actions.md) | 자동 배포 CI/CD, 워크플로우 파일 설명 |
| [08-development-workflow.md](./08-development-workflow.md) | 일상적인 개발 흐름, API 사용 예시, 유용한 명령어 |

## 프론트엔드 문서 (Next.js)

| 파일 | 내용 |
|------|------|
| [09-phase6-frontend-setup.md](./09-phase6-frontend-setup.md) | 아키텍처 결정(역할 분리), Next.js 초기 설정, API 클라이언트, CORS |

## 빠른 참조

**백엔드 서비스 URL**
```
https://money-manager-1094294666571.asia-northeast3.run.app
```

**백엔드 로컬 실행**
```bash
# MoneyManager/ 폴더에서
gcloud auth application-default login
npm run dev
```

**프론트엔드 로컬 실행**
```bash
# MoneyManager/frontend/ 폴더에서
npm run dev
# → http://localhost:3000
```

**배포 방법**
```bash
git add .
git commit -m "변경 내용"
git push origin main
# → GitHub Actions가 자동으로 배포
```
