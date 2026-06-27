# CI/CD: GitHub Actions에 Vercel 자동 배포 추가

## 발생한 문제

Phase 9 작업 후 `git push`를 했음에도 Vercel 프론트엔드에는 변경사항이 반영되지 않았습니다.

**원인 분석:**

Vercel 대시보드에서 배포 소스를 보면 `>_ vercel deploy` 라고 표시되어 있었습니다.
이는 이전에 수동으로 `vercel --prod --yes` CLI 명령을 실행해서 배포했다는 의미입니다.

```
잘못된 흐름 (기존):
  git push
    ↓
  GitHub Actions → Cloud Run 배포만 실행
  Vercel → 자동 배포 없음 (연결 안 됨)

올바른 흐름 (수정 후):
  git push
    ↓
  GitHub Actions → Cloud Run 배포 (백엔드)
                → Vercel 배포 (프론트엔드)  ← 신규 추가
```

기존 워크플로우(`.github/workflows/deploy.yml`)는 Cloud Run 배포만 담당하고 있었고,
Vercel의 GitHub 자동 배포는 연동되어 있지 않은 상태였습니다.

---

## 해결 방법

GitHub Actions 워크플로우에 Vercel 배포 job을 추가했습니다.

---

## Vercel 토큰 발급

GitHub Actions가 Vercel에 배포하려면 **인증 토큰**이 필요합니다.

### 토큰이란?

비밀번호 대신 사용하는 인증 키입니다.
GitHub Actions 서버가 Vercel에 "나는 ChangwooPark입니다"라고 증명할 때 사용합니다.

### 발급 방법

1. `https://vercel.com/account/tokens` 접속
2. TOKEN NAME: `github-actions`
3. SCOPE: `Full Account` (배포·빌드·환경변수 조회 등 모든 권한 필요)
4. EXPIRATION: No Expiration (CI/CD 토큰은 만료 없이 설정 — 만료되면 자동 배포가 갑자기 실패함)
5. **Create** 클릭 → 토큰 값이 화면에 표시됨 (이 순간에만 보임, 나중에 다시 볼 수 없음)

> **주의:** 토큰은 생성 직후 한 번만 표시됩니다.
> 창을 닫기 전에 반드시 복사해야 합니다.
> 분실 시 해당 토큰을 Revoke(삭제)하고 새로 발급해야 합니다.

### GitHub Secret에 등록

발급한 토큰을 GitHub 저장소의 시크릿에 저장합니다.

1. `https://github.com/ChangwooPark/MoneyManager/settings/secrets/actions` 접속
2. "New repository secret" 클릭
3. Name: `VERCEL_TOKEN`
4. Value: 복사한 토큰 값
5. "Add secret" 클릭

GitHub Secret은 암호화되어 저장되며, Actions 워크플로우에서만 `${{ secrets.VERCEL_TOKEN }}` 형태로 참조할 수 있습니다. 저장 후에는 값을 다시 볼 수 없습니다.

---

## 워크플로우 파일 수정

`.github/workflows/deploy.yml`을 수정해 두 개의 job으로 분리했습니다.

```yaml
name: Deploy

on:
  push:
    branches:
      - main

jobs:
  # 백엔드: Cloud Run 배포 (기존과 동일)
  deploy-backend:
    name: Deploy Backend to Cloud Run
    runs-on: ubuntu-latest
    steps:
      - ...

  # 프론트엔드: Vercel 배포 (신규 추가)
  deploy-frontend:
    name: Deploy Frontend to Vercel
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install Vercel CLI
        run: npm install -g vercel

      - name: Pull Vercel project settings
        working-directory: MoneyManager/frontend
        run: vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}
        env:
          VERCEL_ORG_ID: team_C6F9p19SH8pOyJxy7x8OtS82
          VERCEL_PROJECT_ID: prj_5TOJOfymglx2pWt2aQXTDc0B909g

      - name: Build project
        working-directory: MoneyManager/frontend
        run: vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}
        env:
          VERCEL_ORG_ID: team_C6F9p19SH8pOyJxy7x8OtS82
          VERCEL_PROJECT_ID: prj_5TOJOfymglx2pWt2aQXTDc0B909g

      - name: Deploy to Vercel Production
        working-directory: MoneyManager/frontend
        run: vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}
        env:
          VERCEL_ORG_ID: team_C6F9p19SH8pOyJxy7x8OtS82
          VERCEL_PROJECT_ID: prj_5TOJOfymglx2pWt2aQXTDc0B909g
```

---

## Vercel 배포 3단계 설명

Vercel CLI로 CI/CD 환경에서 배포할 때는 3단계로 나눠서 실행합니다.

### 1단계: `vercel pull`

```bash
vercel pull --yes --environment=production --token=...
```

Vercel 프로젝트의 설정 파일과 환경변수를 GitHub Actions 서버로 가져옵니다.
`NEXT_PUBLIC_API_URL` 같은 환경변수가 이 단계에서 로컬에 저장됩니다.

### 2단계: `vercel build`

```bash
vercel build --prod --token=...
```

`next build`를 실행해서 프로덕션용 결과물(`.vercel/output/`)을 생성합니다.
Vercel의 최적화 설정(이미지 최적화, 캐시 설정 등)이 자동 적용됩니다.

### 3단계: `vercel deploy --prebuilt`

```bash
vercel deploy --prebuilt --prod --token=...
```

2단계에서 빌드된 결과물을 Vercel CDN에 업로드하고 Production으로 배포합니다.
`--prebuilt`: 빌드를 Vercel 서버에서 다시 하지 않고 이미 빌드된 파일을 그대로 사용합니다.

---

## VERCEL_ORG_ID / VERCEL_PROJECT_ID

워크플로우에 하드코딩된 두 값은 `MoneyManager/frontend/.vercel/project.json` 파일에서 확인한 값입니다.

```json
{
  "projectId": "prj_5TOJOfymglx2pWt2aQXTDc0B909g",
  "orgId": "team_C6F9p19SH8pOyJxy7x8OtS82",
  "projectName": "frontend"
}
```

이 값들은 어떤 Vercel 프로젝트에 배포할지 지정합니다.
비밀번호가 아닌 식별자이므로 워크플로우에 직접 기재해도 무방합니다.

---

## 수정 후 배포 흐름

```
로컬에서 코드 수정
  ↓
git add . && git commit -m "..."
  ↓
git push origin main
  ↓
GitHub Actions 트리거 (두 job 병렬 실행)
  ├─ Deploy Backend to Cloud Run  (~3~5분)
  │    Docker 빌드 → Artifact Registry 푸시 → Cloud Run 배포
  │
  └─ Deploy Frontend to Vercel    (~1~2분)
       vercel pull → vercel build → vercel deploy
  ↓
https://frontend-dusky-tau-46.vercel.app 에 최신 코드 반영
https://money-manager-1094294666571.asia-northeast3.run.app 에 최신 API 반영
```

두 job은 **병렬**로 실행되므로 전체 배포 시간은 더 긴 쪽(Cloud Run, 약 3~5분)에 맞춰집니다.

---

## 배포 확인 방법

GitHub Actions 진행 상황:
`https://github.com/ChangwooPark/MoneyManager/actions`

두 job 모두 ✅ 초록 체크가 되면 배포 완료입니다.

| Job | 확인 URL |
|-----|---------|
| 프론트엔드 | `https://frontend-dusky-tau-46.vercel.app` |
| 백엔드 | `https://money-manager-1094294666571.asia-northeast3.run.app/health` |
