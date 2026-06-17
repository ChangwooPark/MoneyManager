# 프로젝트: TypeScript 서버리스 가계부

## 기술 스택

| 구분 | 기술 |
|------|------|
| 백엔드 | TypeScript, Node.js, Express |
| 프론트엔드 | Next.js (App Router), TypeScript, Tailwind CSS |
| 데이터베이스 | Google Cloud Firestore (Native Mode) |
| 컨테이너 | Docker (멀티스테이지 빌드) |
| 배포 | Google Cloud Run (asia-northeast3 / 서울) |
| 이미지 저장소 | Google Artifact Registry |
| CI/CD | GitHub Actions |

## 시스템 구조

```
사용자 (브라우저/모바일)
  ↓
Next.js 프론트엔드 (Vercel 또는 Cloud Run)
  ↓
Express 백엔드 API (Cloud Run)
  ↓
Firestore (데이터베이스)
```

## 핵심 방침

- GCP 무료 티어 최대 활용
- Cloud Run `max-instances=1` 설정으로 비용 통제
- TypeScript strict 모드 필수 (`any` 타입 금지)
- 자격증명 하드코딩 금지 (환경 변수 또는 Secret Manager 사용)

---

## 백엔드 구현 로드맵

### Phase 1: 로컬 개발 환경 구성 ✅ 완료
- [x] Node.js & TypeScript 프로젝트 초기화 (`npm init`, `typescript`, `@types/node`, `ts-node` 설치)
- [x] `tsconfig.json` 설정 (strict 모드 활성화)
- [x] Express 서버 구현 (`process.env.PORT || 8080` 포트 사용)
- [x] `@google-cloud/firestore` SDK 연동 및 거래 내역 CRUD 구현

### Phase 2: Docker 컨테이너화 ✅ 완료
- [x] `package.json`에 빌드 스크립트 작성 (`tsc` 컴파일)
- [x] Node.js 프로덕션용 멀티스테이지 `Dockerfile` 작성
- [x] 로컬 컨테이너 실행 검증 (`docker build` & `docker run`, 포트 매핑 확인)

### Phase 3: GCP 인프라 프로비저닝 ✅ 완료
- [x] GCP 프로젝트 생성 및 결제 계정 연결 (프로젝트 ID: `money-manager-499703`)
- [x] Firestore 데이터베이스 생성 (Native Mode, 리전: `asia-northeast3`)
- [x] Artifact Registry Docker 저장소 생성 (리전: `asia-northeast3`)

### Phase 4: CI/CD 및 Cloud Run 배포 ✅ 완료
- [x] Google Cloud SDK로 로컬 인증 (`gcloud auth login`)
- [x] Cloud Build로 컨테이너 이미지 빌드 및 푸시
- [x] Cloud Run 서비스 배포
  - 리전: `asia-northeast3`
  - 비용 통제: `--max-instances=1` 설정
- [x] GitHub Actions 자동 배포 연동 (main 브랜치 push 시 자동 배포)

### Phase 5: 보안 및 검증 ✅ 완료
- [x] Cloud Run Service Account에 `Cloud Datastore User` (Firestore) IAM 권한 부여
- [ ] 커스텀 도메인 연결 (현재 미적용 - 추후 필요 시 진행)

---

## 프론트엔드 구현 로드맵

### Phase 6: Next.js 프로젝트 초기 설정 ✅ 완료
- [x] Next.js (App Router) + TypeScript 프로젝트 생성
- [x] Tailwind CSS 설정 (다크 테마 - CSS 변수 기반)
- [x] 백엔드 API 클라이언트 구현 (`src/lib/api.ts`) ← Firebase 직접 연결 대신 역할 분리 결정으로 변경
- [x] 공통 타입 정의 (`Transaction`, `Budget`, `TabType` 인터페이스)
- [x] 환경 변수 설정 (`.env.local` - `NEXT_PUBLIC_API_URL` 백엔드 URL)
- [x] 백엔드 PIN·예산 API 엔드포인트 추가 (`/settings`, `/budgets`)
- [x] 백엔드 거래 내역 연월 필터 추가 (`?yearMonth=YYYY-MM`)
- [x] 백엔드 CORS 설정 (프론트엔드 도메인 허용)

### Phase 7: 인증 시스템 (4자리 PIN) ✅ 완료
- [x] PIN 입력 화면 구현 (앱 최초 진입 시 노출)
  - 초기 마스터 PIN: `8907` (Firestore `settings/app_settings` 도큐먼트와 비교)
  - 숫자 패드(NumPad) UI 구현 (1~9, 0, ⌫)
  - 4개 점 인디케이터로 입력 진행 표시
  - 오류 시 빨간색 전환 후 0.6초 뒤 자동 초기화
- [x] 인증 성공 시 세션 유지 처리 (`sessionStorage` 기반, 탭 종료 시 만료)
- [x] `AppShell` 컴포넌트로 인증 상태 전역 관리
- [ ] PIN 변경 기능 ('더보기' 탭 내 구현) ← Phase 13에서 UI와 함께 구현 예정
  - 백엔드 API(`PUT /settings/pin`)는 이미 완료

### Phase 8: 공통 레이아웃 및 네비게이션 ✅ 완료
- [x] 모바일 퍼스트 반응형 레이아웃
  - 모바일: 전체 화면 앱 스타일 (`h-full`, `flex flex-col`)
  - PC/태블릿: `max-w-md` 중앙 배치 (`layout.tsx`에서 설정)
  - 모든 터치 타깃 최소 44×44px 확보 (탭바 64px, 버튼 40px)
- [x] 하단 고정 네비게이션 바 (탭바) 구현 (`BottomNav.tsx`)
  - 탭 1: 홈 (일일 내역)
  - 탭 2: 달력
  - 탭 3: 통계
  - 탭 4: 더보기
  - 활성 탭 강조색 표시, `flexShrink:0`으로 항상 최하단 고정
- [x] 공통 연월 선택기 컴포넌트 (`MonthSelector.tsx`) — 홈·달력·통계 탭에만 표시
- [x] `MainApp.tsx` — 탭 상태·연월 상태 통합 관리, 각 탭 컴포넌트 조건부 렌더링
- [x] 각 탭 플레이스홀더 컴포넌트 생성 (`HomeTab`, `CalendarTab`, `StatsTab`, `MoreTab`)
- [x] 모든 컴포넌트에 상세 한국어 주석 추가

### Phase 9: 거래 내역 입력 폼
- [ ] 플로팅 액션 버튼(FAB) 또는 상단 '+' 버튼으로 모달/페이지 진입
- [ ] 입력 필드 구현
  - 날짜 (기본값: 오늘)
  - 수입/지출 선택 토글
  - 카테고리(내용)
  - 금액 (엔화 ¥ 단위)
  - 메모
- [ ] 모바일 가상 키보드 오픈 시 레이아웃 유지 (스크롤 영역 지정)
- [ ] Firestore `transactions` 컬렉션에 서버 타임스탬프와 함께 저장

### Phase 10: 홈 화면 (일일 내역 탭)
- [ ] 선택된 연월의 거래 내역을 일자별 그룹화하여 리스트 표시
- [ ] 최신 날짜 및 최신 등록 순(DESC) 역순 정렬
- [ ] 상단 예산 대시보드 표시
  - [설정 예산] - [당월 총 지출] = [남은 잔여 예산]
- [ ] 금액 단위: 엔화(¥) 형식 출력
- [ ] Firestore 실시간 연동 (`onSnapshot`)

### Phase 11: 달력 화면 (달력 탭)
- [ ] 월간 그리드 달력 구현 (7열)
  - 각 날짜에 총 수입/지출 금액 소형 텍스트 표시
  - 모바일 폭에 맞춰 폰트 크기 유동적 조절
- [ ] 날짜 클릭 시 하단 시트(Bottom Sheet) 또는 모달로 해당 날짜 상세 내역 표시

### Phase 12: 통계 화면 (통계 탭)
- [ ] 상단 [수입] / [지출] 전환 탭 구현
- [ ] [내용 | 건수 | 금액] 헤더를 가진 카테고리별 리스트 뷰
- [ ] 정렬 기능 (금액 오름차순/내림차순 토글)

### Phase 13: 더보기 화면
- [ ] PIN 번호 변경 UI
- [ ] 월별 목표 예산 설정 UI
  - 당월 목표 예산 금액 입력 및 수정
  - Firestore `budgets` 컬렉션에 저장

---

## 서비스 URL 및 GCP 정보

| 항목 | 값 |
|------|------|
| 백엔드 URL | `https://money-manager-1094294666571.asia-northeast3.run.app` |
| GCP 프로젝트 ID | `money-manager-499703` |
| 리전 | `asia-northeast3` (서울) |
| Firestore DB | `(default)` Native Mode |
| Artifact Registry | `money-manager` |
| Cloud Run 서비스 | `money-manager` |

---

## 코딩 규칙 및 제약사항

1. **TypeScript strict 모드**: 타입 안전 코드 필수, `any` 타입 사용 금지
2. **환경 변수**: 자격증명 하드코딩 금지, GCP 런타임 환경 변수 또는 Secret Manager 사용
3. **무상태(Stateless) 서비스**: Cloud Run은 무상태, 임시 파일이나 세션 데이터를 컨테이너 로컬 디스크에 저장 금지, Firestore 사용
4. **Firestore 실시간 연동**: 데이터 변경 시 `onSnapshot` 또는 효율적인 Revalidate로 화면 갱신
5. **다크 테마**: Tailwind CSS 다크 테마, 모바일 가독성 확보, 컴팩트한 UI
6. **엔화 표기**: 모든 금액은 ¥ 형식으로 출력
