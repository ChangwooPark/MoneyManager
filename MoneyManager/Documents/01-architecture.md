# 시스템 아키텍처 개요

## 프로젝트 소개

TypeScript로 작성된 가계부(Account Book) 서버입니다.
Google Cloud Platform(GCP)의 무료 티어를 최대한 활용하여 비용을 최소화하는 것을 목표로 합니다.

## 기술 스택

| 기술 | 역할 |
|------|------|
| TypeScript | 주 개발 언어 |
| Node.js | 런타임 환경 |
| Express | HTTP 서버 프레임워크 |
| Docker | 컨테이너화 |
| Google Cloud Run | 서버 실행 환경 |
| Google Cloud Firestore | 데이터베이스 |
| Google Artifact Registry | Docker 이미지 저장소 |
| Google Cloud Build | 클라우드 빌드 도구 |
| GitHub Actions | 자동 배포(CI/CD) |

## 전체 구조

```
개발자 (로컬)
  │
  │  git push
  ▼
GitHub (ChangwooPark/MoneyManager)
  │
  │  자동 트리거
  ▼
GitHub Actions
  ├─ Docker 이미지 빌드
  ├─ Artifact Registry 푸시
  └─ Cloud Run 배포
       │
       │  HTTP 요청
       ▼
    Cloud Run (money-manager)
    asia-northeast3 (서울)
       │
       │  읽기/쓰기
       ▼
    Firestore (데이터베이스)
    asia-northeast3 (서울)
```

## API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| GET | `/health` | 서버 상태 확인 |
| GET | `/transactions` | 전체 거래 내역 조회 |
| GET | `/transactions/:id` | 단건 거래 내역 조회 |
| POST | `/transactions` | 거래 내역 생성 |
| PUT | `/transactions/:id` | 거래 내역 수정 |
| DELETE | `/transactions/:id` | 거래 내역 삭제 |

## 서비스 URL

```
https://money-manager-1094294666571.asia-northeast3.run.app
```

## GCP 프로젝트 정보

| 항목 | 값 |
|------|------|
| 프로젝트 ID | `money-manager-499703` |
| 리전 | `asia-northeast3` (서울) |
| Firestore DB | `(default)` Native Mode |
| Artifact Registry | `money-manager` |
| Cloud Run 서비스 | `money-manager` |
