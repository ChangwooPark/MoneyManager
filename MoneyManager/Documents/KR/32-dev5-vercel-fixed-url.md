# Phase Dev-5 — Vercel 개발 고정 URL 설정 학습 문서

## 개요

개발 환경 프론트엔드 배포 시 매번 다른 일회성 URL이 생성되는 문제를 해결하고,
`vercel alias` 명령으로 항상 동일한 고정 URL을 유지하는 방식을 구성한 과정을 설명합니다.

---

## 1. 문제 — 일회성 Preview URL

Vercel은 `--prod` 없이 배포하면 커밋마다 새로운 고유 URL을 생성합니다.

```
develop 첫 번째 push  → https://frontend-abc123-changwoo-park.vercel.app
develop 두 번째 push  → https://frontend-def456-changwoo-park.vercel.app
develop 세 번째 push  → https://frontend-ghi789-changwoo-park.vercel.app
```

팀 단위 개발에서는 PR별 독립 URL이 유용하지만, 혼자 개발하는 환경에서는
**매번 새 URL을 Actions 로그에서 찾아야 하는 번거로움**이 생깁니다.

---

## 2. 해결 — vercel alias

`vercel alias set` 명령은 특정 배포 URL에 고정된 별칭(alias)을 붙입니다.
`develop`에 push할 때마다 새 배포 URL이 생성되지만, alias는 항상 최신 배포를 가리킵니다.

```
develop 첫 번째 push  → frontend-abc123-changwoo-park.vercel.app  ← frontend-dev-changwoo-park.vercel.app
develop 두 번째 push  → frontend-def456-changwoo-park.vercel.app  ← frontend-dev-changwoo-park.vercel.app (갱신)
develop 세 번째 push  → frontend-ghi789-changwoo-park.vercel.app  ← frontend-dev-changwoo-park.vercel.app (갱신)
```

고정 URL은 항상 가장 최근에 배포된 개발 빌드를 가리킵니다.

---

## 3. deploy-dev.yml 수정 내용

### 수정 전

```yaml
# --prod 없이 배포 → 일회성 Preview URL 생성
- name: Deploy to Vercel Preview
  run: vercel deploy --prebuilt --token=${{ secrets.VERCEL_TOKEN }}
```

### 수정 후

```yaml
# 배포 후 고정 alias 적용 — develop push마다 동일한 URL이 최신 빌드를 가리킴
- name: Deploy and alias to fixed dev URL
  run: |
    DEPLOY_URL=$(vercel deploy --prebuilt --token=${{ secrets.VERCEL_TOKEN }})
    vercel alias set $DEPLOY_URL frontend-dev-changwoo-park.vercel.app --token=${{ secrets.VERCEL_TOKEN }}
```

### 핵심 변경 포인트

| 항목 | 설명 |
|------|------|
| `DEPLOY_URL=$(...)` | `vercel deploy`의 출력(배포된 고유 URL)을 변수에 저장 |
| `vercel alias set A B` | A(고유 배포 URL)에 B(고정 alias)를 연결하는 명령 |
| `--token=` | CI 환경에서 Vercel CLI 인증에 사용하는 액세스 토큰 |

---

## 4. 최종 URL 구성

| 환경 | 고정 URL | 배포 트리거 |
|------|---------|------------|
| 운영 | `https://frontend-changwoo-park.vercel.app` | `main` 브랜치 push |
| 개발 | `https://frontend-dev-changwoo-park.vercel.app` | `develop` 브랜치 push |

---

## 5. vercel alias 동작 원리

```
vercel deploy --prebuilt
  → Vercel 서버에 빌드 결과물 업로드
  → 고유 URL 생성: frontend-xxx-changwoo-park.vercel.app
  → 이 URL을 DEPLOY_URL 변수에 저장

vercel alias set $DEPLOY_URL frontend-dev-changwoo-park.vercel.app
  → Vercel DNS 테이블에서 frontend-dev-changwoo-park.vercel.app → frontend-xxx-changwoo-park.vercel.app 로 업데이트
  → 브라우저에서 고정 URL 접속 시 최신 배포로 라우팅
```

alias는 즉시 반영되며 추가 DNS 전파 대기 시간이 없습니다.

---

## 6. 핵심 개념 정리

| 개념 | 설명 |
|------|------|
| Vercel Preview URL | `--prod` 없이 배포 시 커밋마다 자동 생성되는 고유 URL |
| `vercel alias set` | 특정 배포 URL에 고정 별칭을 연결하는 Vercel CLI 명령 |
| `$(명령)` | 셸에서 명령의 출력값을 변수에 저장하는 문법 (커맨드 치환) |
| alias 갱신 | 같은 alias를 `set`하면 이전 연결이 덮어씌워지므로 항상 최신 배포를 가리킴 |
