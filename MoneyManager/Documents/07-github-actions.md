# GitHub Actions 자동 배포(CI/CD)

## CI/CD란?

| 용어 | 의미 |
|------|------|
| CI (Continuous Integration) | 코드를 push할 때마다 자동으로 빌드/테스트 |
| CD (Continuous Deployment) | 빌드 성공 시 자동으로 배포 |

이 프로젝트는 main 브랜치에 push하면 자동으로 Cloud Run에 배포됩니다.

## 전체 자동 배포 흐름

```
git push (main 브랜치)
  ↓
GitHub이 push 이벤트 감지
  ↓
.github/workflows/deploy.yml 실행
  ↓
  1. 코드 체크아웃
  2. GCP 인증
  3. Cloud SDK 설정
  4. Docker 인증
  5. Docker 이미지 빌드 & Artifact Registry 푸시
  6. Cloud Run 재배포
  ↓
서비스 URL에 새 버전 반영 (약 1~2분 소요)
```

## workflow 파일 설명

`.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloud Run

on:
  push:
    branches:
      - main          # main 브랜치에 push될 때만 실행
```

**on.push.branches: [main]** 의 의미:
다른 브랜치(feature/xxx, develop 등)에 push해도 배포가 실행되지 않습니다.
실험적인 작업은 별도 브랜치에서 안전하게 할 수 있습니다.

```yaml
    steps:
      - name: Build and push image
        run: |
          IMAGE=asia-northeast3-docker.pkg.dev/${{ secrets.GCP_PROJECT_ID }}/money-manager/account-book:${{ github.sha }}
          docker build -t $IMAGE MoneyManager/
          docker push $IMAGE
```

**`${{ github.sha }}`** 란?
각 커밋의 고유 해시값(예: `bcbd826...`)으로 이미지 태그를 붙입니다.
이렇게 하면 배포 이력을 추적하고, 문제 발생 시 이전 버전으로 롤백할 수 있습니다.

## GitHub Secrets

GitHub Actions가 GCP에 접근하려면 인증 정보가 필요합니다.
코드에 직접 키를 넣으면 보안 위험이 있으므로 **GitHub Secrets**에 암호화해서 저장합니다.

| Secret 이름 | 내용 |
|------------|------|
| `GCP_SA_KEY` | GitHub Actions용 Service Account JSON 키 |
| `GCP_PROJECT_ID` | GCP 프로젝트 ID (`money-manager-499703`) |

워크플로우에서 `${{ secrets.GCP_SA_KEY }}` 형태로 참조합니다.

**Secrets 확인 위치:**
GitHub 저장소 → Settings → Secrets and variables → Actions

## 배포 결과 확인

```
GitHub 저장소 → Actions 탭
```

각 push마다 워크플로우 실행 결과를 확인할 수 있습니다.
- 초록색 체크: 배포 성공
- 빨간색 X: 배포 실패 (로그에서 원인 확인 가능)

## 브랜치 전략 (권장)

```bash
# 새 기능 개발 시
git checkout -b feature/카테고리-추가
# ... 개발 ...
git push origin feature/카테고리-추가
# → 배포 안 됨 (안전)

# 개발 완료 후 배포
git checkout main
git merge feature/카테고리-추가
git push origin main
# → 자동 배포 실행
```

이렇게 하면 미완성 코드가 실수로 배포되는 일을 방지할 수 있습니다.
