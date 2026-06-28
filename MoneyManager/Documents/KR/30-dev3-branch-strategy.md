# Phase Dev-3 — GitHub 브랜치 전략 구성 학습 문서

## 개요

운영(main)과 개발(develop) 브랜치를 분리하고, main 브랜치에 보호 규칙을 적용한 과정을 설명합니다.

---

## 1. 브랜치 전략이 필요한 이유

브랜치(Branch)는 같은 코드베이스에서 **독립적인 작업 공간**을 만드는 Git 기능입니다.

브랜치를 나누지 않으면:
- 개발 중인 미완성 코드가 바로 운영에 배포될 수 있음
- 버그가 생겼을 때 어느 변경이 원인인지 추적하기 어려움
- 기능 개발 중에 긴급 수정이 필요할 때 코드가 뒤섞임

---

## 2. 브랜치 구성

```
main ────────────────────────────────▶  운영 서버 (Production)
  │
  └── develop ──────────────────────▶  개발 서버 (Development)
```

| 브랜치 | 용도 | 배포 대상 | 직접 push |
|--------|------|-----------|-----------|
| `main` | 검증 완료된 코드만 병합 | 운영 서버 | ❌ 금지 (보호 규칙) |
| `develop` | 기능 개발 및 테스트 | 개발 서버 | ✅ 허용 |

---

## 3. develop 브랜치 생성

```bash
# main 브랜치를 기준으로 develop 브랜치 생성 + 전환
git checkout -b develop

# GitHub 원격 저장소에 푸시하고 추적 브랜치로 설정
# -u 옵션: 이후 git push/pull 시 origin/develop을 자동 참조
git push -u origin develop
```

### `-u` 옵션이란?

`--set-upstream`의 줄임말입니다.
이 옵션 없이 그냥 `git push origin develop` 만 하면 매번 `git push origin develop` 이라고 전체 경로를 써야 하지만, `-u`를 한 번 쓰면 이후에는 `git push` 만으로 동일한 동작을 합니다.

---

## 4. main 브랜치 보호 규칙 설정

### 설정 내용

```bash
gh api repos/ChangwooPark/MoneyManager/branches/main/protection \
  --method PUT \
  --field allow_force_pushes=false \   # force push 금지
  --field allow_deletions=false        # 브랜치 삭제 금지
```

### force push란?

일반 push는 기존 커밋 위에 새 커밋을 쌓습니다.
force push(`git push --force`)는 원격의 커밋 히스토리를 **강제로 덮어씁니다.**

```
일반 push:   A → B → C → D(새 커밋 추가)
force push:  A → B → C → D  를  A → E 로 덮어씀 (B, C, D 기록 삭제)
```

운영 브랜치에서 force push가 발생하면 배포 히스토리가 사라지고 롤백이 불가능해지므로 반드시 금지합니다.

### GitHub UI에서 확인하는 방법

```
저장소 → Settings → Branches → Branch protection rules
→ main 규칙 항목 확인
```

---

## 5. 설정 결과 확인

```bash
gh api repos/ChangwooPark/MoneyManager/branches \
  --jq '.[] | {name: .name, protected: .protected}'
```

```json
{"name": "develop", "protected": false}
{"name": "main",    "protected": true}
```

- `main`: 보호 적용 ✅
- `develop`: 보호 없음 (개인 프로젝트, 자유롭게 push 가능) ✅

---

## 6. 일상적인 개발 흐름

```bash
# 1. develop 브랜치로 전환
git checkout develop

# 2. 기능 개발 및 커밋
git add .
git commit -m "Feat: 새 기능 추가"

# 3. 개발 서버에 반영 (GitHub Actions가 자동 배포)
git push origin develop

# 4. 개발 서버에서 확인 후 운영으로 반영할 때
git checkout main
git merge develop
git push origin main   # 운영 배포 시작
```

---

## 7. 핵심 개념 정리

| 개념 | 설명 |
|------|------|
| 브랜치(Branch) | 동일한 코드베이스에서 독립적인 작업 공간을 만드는 Git 기능 |
| `git checkout -b` | 새 브랜치를 생성하고 동시에 전환하는 명령 |
| `git push -u` | 원격 브랜치를 생성하고 추적 관계를 설정 (이후 git push만으로 동작) |
| 브랜치 보호 규칙 | 특정 브랜치에 force push·삭제 등 위험한 작업을 GitHub 수준에서 차단하는 설정 |
| force push | 원격 커밋 히스토리를 강제로 덮어쓰는 위험한 push. 운영 브랜치에서는 반드시 금지 |
| PR(Pull Request) | 한 브랜치의 변경을 다른 브랜치에 병합 요청하는 GitHub 기능. 코드 리뷰의 기본 단위 |
