# MoneyManager 문서

TypeScript + GCP 기반 가계부 프로젝트 전체 문서입니다.

- **[KR/](./KR/)** — 한국어 학습 자료
- **[JP/](./JP/)** — 日本語学習資料

---

## 문서 목록

| 파일 | 내용 |
|------|------|
| [01-architecture](./KR/01-architecture.md) | 전체 시스템 구조, 기술 스택, API 목록 |
| [02-local-development](./KR/02-local-development.md) | 로컬 개발 환경 구성, 파일 구조, 주요 코드 설명 |
| [03-docker](./KR/03-docker.md) | Docker 개념, Dockerfile 설명, 멀티스테이지 빌드 |
| [04-gcp-infrastructure](./KR/04-gcp-infrastructure.md) | Firestore, Artifact Registry 구성, GCP 무료 티어 |
| [05-cloud-run-deployment](./KR/05-cloud-run-deployment.md) | Cloud Run 배포 방법, 비용 제어, 서버리스 개념 |
| [06-iam-security](./KR/06-iam-security.md) | IAM 권한, Service Account, 보안 설정 |
| [07-github-actions](./KR/07-github-actions.md) | 자동 배포 CI/CD, 워크플로우 파일 설명 |
| [08-development-workflow](./KR/08-development-workflow.md) | 일상적인 개발 흐름, API 사용 예시, 유용한 명령어 |
| [09-phase6-frontend-setup](./KR/09-phase6-frontend-setup.md) | Next.js 초기 설정, API 클라이언트, CORS |
| [10-phase7-pin-auth](./KR/10-phase7-pin-auth.md) | PIN 인증 화면, AppShell 세션 관리, sessionStorage |
| [11-phase8-layout-navigation](./KR/11-phase8-layout-navigation.md) | 공통 레이아웃, 하단 탭바, 연월 선택기 |
| [12-vercel-deployment](./KR/12-vercel-deployment.md) | Vercel 개념, 배포 과정, CORS 설정, CDN |
| [13-phase9-transaction-form](./KR/13-phase9-transaction-form.md) | FAB 버튼, 바텀 시트 입력 폼, 수입/지출 토글 |
| [14-cicd-vercel-github-actions](./KR/14-cicd-vercel-github-actions.md) | Vercel 자동 배포, GitHub Actions Vercel job |
| [15-debug-env-var-empty](./KR/15-debug-env-var-empty.md) | 트러블슈팅: 프로덕션 PIN 인증 실패 디버깅 |
| [16-phase10-home-tab](./KR/16-phase10-home-tab.md) | 홈 화면 구현, 날짜별 그룹화, 예산 대시보드 |
| [17-phase11-calendar-tab](./KR/17-phase11-calendar-tab.md) | 달력 화면, 월간 그리드, 날짜 클릭 바텀시트 |
| [18-bash-commands-guide](./KR/18-bash-commands-guide.md) | Bash 명령어 정리 (GCP, Docker, Git, npm 등) |
| [19-phase12-stats-tab](./KR/19-phase12-stats-tab.md) | 통계 화면, 카테고리별 집계, 정렬 기능 |
| [20-phase13-more-tab](./KR/20-phase13-more-tab.md) | 더보기 화면, PIN 변경, 예산 설정, 카테고리 관리 |
| [21-phase13-5-ux-improvements](./KR/21-phase13-5-ux-improvements.md) | 즉시 적용된 UX 개선 사항 |
| [22-phase14-1-common-ux](./KR/22-phase14-1-common-ux.md) | 공통 UX 개선 (FAB 너비, 스크롤 고정, 바텀시트) |
| [23-phase14-2-more-tab](./KR/23-phase14-2-more-tab.md) | 아코디언 단일 열림, 데이터 초기화 기능 |
| [24-phase14-3-home-tab](./KR/24-phase14-3-home-tab.md) | 홈 탭 보강 (구분선, 순수익, 메모, 거래 상세) |
| [25-phase16-stats-category](./KR/25-phase16-stats-category.md) | 통계 탭 카테고리 클릭 → 거래 상세 바텀시트 |
| [26-phase17-line-notification](./KR/26-phase17-line-notification.md) | LINE Messaging API 알림, Webhook, Multicast |
| [27-line-partner-setup](./KR/27-line-partner-setup.md) | LINE 파트너 추가 설정 가이드 (Webhook, 자동응답 OFF, 등록 절차) |
| [28-phase19-detail-sheet](./KR/28-phase19-detail-sheet.md) | 거래 상세 시트 공통화, 바텀시트 minHeight, z-index, Props Drilling |
| [29-dev-environment-setup](./KR/29-dev-environment-setup.md) | 개발 환경 구축 (GCP 프로젝트 분리, Service Account, Secret Manager, Cloud Run) |
| [30-dev3-branch-strategy](./KR/30-dev3-branch-strategy.md) | GitHub 브랜치 전략 (develop 브랜치 생성, main 보호 규칙, force push 개념) |
| [31-dev4-github-actions-split](./KR/31-dev4-github-actions-split.md) | GitHub Actions 워크플로우 분리 (deploy-prod.yml / deploy-dev.yml, secrets, github.sha) |
| [32-dev5-vercel-fixed-url](./KR/32-dev5-vercel-fixed-url.md) | Vercel 개발 고정 URL 설정 (vercel alias, Preview URL vs 고정 URL, 커맨드 치환) |
| [33-phase15-ios-pull-to-refresh](./KR/33-phase15-ios-pull-to-refresh.md) | iOS Safari Pull-to-Refresh 충돌 해결 (overscrollBehavior, useEffect cleanup, passive 이벤트) |
| [34-dev6-separation-verification](./KR/34-dev6-separation-verification.md) | 운영/개발 완전 분리 최종 검증 (DB 격리 확인, E2E URL 환경변수화, PLAYWRIGHT_BASE_URL) |

---

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
git push origin main
# → GitHub Actions가 자동으로 배포
```
