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

**완료 체크리스트**
- E2E 테스트 — 해당 없음 (백엔드/인프라 페이즈)
- [x] 공부용 Documents 파일 작성 (`Documents/02-local-development.md`)

### Phase 2: Docker 컨테이너화 ✅ 완료
- [x] `package.json`에 빌드 스크립트 작성 (`tsc` 컴파일)
- [x] Node.js 프로덕션용 멀티스테이지 `Dockerfile` 작성
- [x] 로컬 컨테이너 실행 검증 (`docker build` & `docker run`, 포트 매핑 확인)

**완료 체크리스트**
- E2E 테스트 — 해당 없음 (백엔드/인프라 페이즈)
- [x] 공부용 Documents 파일 작성 (`Documents/03-docker.md`)

### Phase 3: GCP 인프라 프로비저닝 ✅ 완료
- [x] GCP 프로젝트 생성 및 결제 계정 연결 (프로젝트 ID: `money-manager-499703`)
- [x] Firestore 데이터베이스 생성 (Native Mode, 리전: `asia-northeast3`)
- [x] Artifact Registry Docker 저장소 생성 (리전: `asia-northeast3`)

**완료 체크리스트**
- E2E 테스트 — 해당 없음 (백엔드/인프라 페이즈)
- [x] 공부용 Documents 파일 작성 (`Documents/04-gcp-infrastructure.md`)

### Phase 4: CI/CD 및 Cloud Run 배포 ✅ 완료
- [x] Google Cloud SDK로 로컬 인증 (`gcloud auth login`)
- [x] Cloud Build로 컨테이너 이미지 빌드 및 푸시
- [x] Cloud Run 서비스 배포
  - 리전: `asia-northeast3`
  - 비용 통제: `--max-instances=1` 설정
- [x] GitHub Actions 자동 배포 연동 (main 브랜치 push 시 자동 배포)

**완료 체크리스트**
- E2E 테스트 — 해당 없음 (백엔드/인프라 페이즈)
- [x] 공부용 Documents 파일 작성 (`Documents/05-cloud-run-deployment.md`, `Documents/07-github-actions.md`)

### Phase 5: 보안 및 검증 ✅ 완료
- [x] Cloud Run Service Account에 `Cloud Datastore User` (Firestore) IAM 권한 부여
- [ ] 커스텀 도메인 연결 (현재 미적용 - 추후 필요 시 진행)

**완료 체크리스트**
- E2E 테스트 — 해당 없음 (백엔드/인프라 페이즈)
- [x] 공부용 Documents 파일 작성 (`Documents/06-iam-security.md`)

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

**완료 체크리스트**
- E2E 테스트 — 해당 없음 (초기 설정 단계, Phase 7+ 테스트에서 통합 검증됨)
- [x] 공부용 Documents 파일 작성 (`Documents/09-phase6-frontend-setup.md`)

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

**완료 체크리스트**
- [x] E2E 테스트 코드 작성 (`tests/pin-screen.spec.ts`)
- [x] E2E 테스트 전체 통과 ✅
- [x] 공부용 Documents 파일 작성 (`Documents/10-phase7-pin-auth.md`)

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

**완료 체크리스트**
- [x] E2E 테스트 코드 작성 (`tests/main-app.spec.ts` — 레이아웃·네비게이션·탭 전환 항목)
- [x] E2E 테스트 전체 통과 ✅
- [x] 공부용 Documents 파일 작성 (`Documents/11-phase8-layout-navigation.md`)

### Phase 9: 거래 내역 입력 폼 ✅ 완료
- [x] 플로팅 액션 버튼(FAB) `+` 버튼으로 바텀 시트 폼 진입 (우하단 고정, `MainApp.tsx`)
- [x] 입력 필드 구현 (`TransactionForm.tsx`)
  - 날짜 (기본값: 오늘, `input[type="date"]`)
  - 수입/지출 선택 토글 (색상 동적 변경: 수입=초록, 지출=빨강)
  - 카테고리(내용) 텍스트 입력
  - 금액 (엔화 ¥ 단위, 숫자만 허용, 입력 중 `¥12,000` 형식 미리보기)
  - 메모 (선택 항목)
- [x] 모바일 가상 키보드 오픈 시 레이아웃 유지 (`overflow-y-auto` + `max-h-[90vh]`)
- [x] 백엔드 API(`POST /transactions`) → Firestore `transactions` 컬렉션에 저장
- [x] 저장 후 `refreshKey` 증가로 HomeTab 목록 재조회 트리거 연결 (Phase 10에서 활용)

**완료 체크리스트**
- [x] E2E 테스트 코드 작성
  - `tests/main-app.spec.ts` (폼 유효성·저장·오류 항목)
  - `tests/transaction-form-category-drag.spec.ts` (카테고리 칩·저장 API 연동)
  - `tests/transaction-form-drag.spec.ts` (핸들 바 드래그·CDP 터치 에뮬레이션)
  - `tests/transaction-form-viewport.spec.ts` (모바일 뷰포트·날짜 입력 위치)
- [x] E2E 테스트 전체 통과 ✅
- [x] 공부용 Documents 파일 작성 (`Documents/13-phase9-transaction-form.md`)

### Phase 10: 홈 화면 (일일 내역 탭) ✅ 완료
- [x] 선택된 연월의 거래 내역을 일자별 그룹화하여 리스트 표시
- [x] 최신 날짜 및 최신 등록 순(DESC) 역순 정렬
  - Firestore: `orderBy('date', 'desc')`
  - JS 2차 정렬: `createdAt` DESC (복합 인덱스 없이도 동작)
- [x] 상단 예산 대시보드 표시
  - 예산 / 지출 / 잔여(또는 수입) 3분할 카드
  - 예산 소진 진행 바 (90% 이상 시 빨간 경고)
  - 예산 미설정 시 "미설정" 표기 후 수입 총액 표시
- [x] 금액 단위: 엔화(¥) 형식 출력
- [x] 거래 저장 후 refreshKey 트리거로 목록 자동 갱신
- [x] 로딩 / 오류 / 빈 상태(empty state) 처리
- [ ] Firestore 실시간 연동 (`onSnapshot`) ← Phase 14에서 개선 예정

**완료 체크리스트**
- [x] E2E 테스트 코드 작성 (`tests/home-tab.spec.ts` — 54개 테스트)
- [x] E2E 테스트 전체 통과 ✅ (Chromium + Mobile Chrome 54/54)
- [x] 공부용 Documents 파일 작성 (`Documents/16-phase10-home-tab.md`)

### Phase 11: 달력 화면 (달력 탭) ✅ 완료
- [x] 월간 그리드 달력 구현 (7열)
  - 각 날짜에 총 수입/지출 금액 소형 텍스트 표시 (万/千 단위 단축)
  - 모바일 폭에 맞춰 폰트 크기 유동적 조절 (text-[9px])
- [x] 날짜 클릭 시 하단 시트(Bottom Sheet)로 해당 날짜 상세 내역 표시
- [x] 오늘 날짜 하이라이트, 일요일/토요일 색상 구분
- [x] refreshKey 연동 — 거래 저장 후 달력 자동 갱신

**완료 체크리스트**
- [x] E2E 테스트 코드 작성 (`tests/calendar-tab.spec.ts` — 42개 테스트)
- [x] E2E 테스트 전체 통과 ✅ (Chromium + Mobile Chrome 42/42)
- [x] 공부용 Documents 파일 작성 (`Documents/17-phase11-calendar-tab.md`)

### ✅ Phase 12: 통계 화면 (통계 탭)
- [x] 상단 [수입] / [지출] 전환 탭 구현
- [x] [내용 | 건수 | 금액] 헤더를 가진 카테고리별 리스트 뷰
- [x] 정렬 기능 (금액 오름차순/내림차순 토글)
- [x] 카테고리별 비율 게이지 바 + 전체 합계 요약 행

**완료 체크리스트**
- [x] E2E 테스트 코드 작성 (`tests/stats-tab.spec.ts` — 40개)
- [x] E2E 테스트 전체 통과 (chromium + Mobile Chrome, 40/40)
- [x] 공부용 Documents 파일 작성 (`Documents/19-phase12-stats-tab.md`)

### ✅ Phase 13: 더보기 화면
- [x] PIN 번호 변경 UI
- [x] 월별 목표 예산 설정 UI
  - 당월 목표 예산 금액 입력 및 수정
  - Firestore `budgets` 컬렉션에 저장
- [x] 카테고리 관리 UI
  - 지출/수입 카테고리 목록을 Firestore `categories` 컬렉션으로 이전하여 DB 관리
  - 더보기 탭에서 카테고리 추가·삭제 가능한 편집 화면 구현
  - 백엔드 API(`GET /categories`, `POST /categories`, `DELETE /categories/:id`) 추가 및 Cloud Run 배포
  - TransactionForm 카테고리 목록 → Firestore API 연동 (FALLBACK_CATEGORIES 패턴)

**완료 체크리스트**
- [x] E2E 테스트 코드 작성 (`tests/more-tab.spec.ts` — 18개)
- [x] E2E 테스트 전체 통과 ✅ (Chromium + Mobile Chrome 36/36)
- [x] 공부용 Documents 파일 작성 (`Documents/20-phase13-more-tab.md`)

### Phase 13.5: 즉시 적용된 UX 개선 ✅ 완료

#### 더보기 탭
- [x] **FAB 버튼 더보기 탭 숨김** — 더보기 탭에서는 거래 추가 FAB 불필요 → `activeTab !== 'more'` 조건 추가 (`MainApp.tsx`)

#### 달력 탭
- [x] **달력 화면 전체 채우기** — 연월 선택바와 하단 탭바 제외한 전체 공간을 달력으로 채움
  - `main`에 `flex flex-col` 추가, CalendarTab 래퍼에 `flex-1` 적용
  - 각 주(week) 행이 `flex-1`로 균등 높이 분배
- [x] **날짜 사이 구분선 추가** — 주 사이 수평선 + 요일 사이 수직선 (`var(--border)` 색상, 1px)

#### 스크롤 기능 검증 (E2E)
- [x] **홈 탭 스크롤 테스트** — 25개 거래로 scrollHeight > clientHeight 검증, 상하 스크롤 가능 확인
- [x] **통계 탭 스크롤 테스트** — 20개 카테고리로 스크롤 영역 생성 확인, 탭바 고정 위치 검증
  - `tests/scroll.spec.ts` — 16개 테스트 (Chromium + Mobile Chrome 16/16 ✅)

---

### Phase 14.1: 공통 UX 개선

- [ ] **FAB 모달 너비 조정 — 앱 컨테이너 내로 제한**
  - 현재: FAB(+) 버튼으로 여는 수입/지출 입력 바텀시트가 브라우저 뷰포트 전체 너비를 차지함
  - 문제: 웹에서 볼 때 앱 컨테이너(`max-w-md` ≈ 448px)를 벗어나 좌우로 넘침
  - 개선: 달력 날짜 클릭 시 뜨는 바텀시트처럼, 부모 앱 컨테이너 너비를 벗어나지 않도록 제한
  - 참고: `TransactionForm.tsx` 오버레이/시트 너비 설정 → 달력 바텀시트 방식 참고
- [ ] **상단 연월 선택바 · 하단 탭바 스크롤 시 고정**
  - 현재: 홈·달력·통계 탭에서 화면을 스크롤하면 상단 연월 선택바와 하단 탭바까지 함께 움직임
  - 개선: 연월 선택바(상단)와 탭바(하단)는 고정, 중간 콘텐츠 영역만 스크롤
  - 레이아웃 구조 재검토 필요 (`position: sticky` 또는 `flex + overflow` 구조 조정)
  - 통계 탭의 경우 수입/지출 전환 탭도 스크롤 시 고정 유지 필요
- [ ] **거래 입력 모달 — 배경 스크롤 차단**
  - 현재 문제: 모달이 열린 상태에서 드래그(닫기 시도)를 하면, 모달보다 뒤의 홈/통계 화면이 먼저 스크롤됨
  - 개선: 모달이 열려있는 동안 배경(`body` 또는 메인 스크롤 영역)에 `overflow: hidden` 적용하여 배경 스크롤 차단
  - 모달의 터치/드래그 이벤트가 배경으로 전파되지 않도록 이벤트 전파 차단(`e.stopPropagation()`) 검토
- [ ] **달력 날짜 상세 바텀시트 — 드래그로 닫기 기능 추가**
  - 현재: 달력에서 날짜 클릭 시 열리는 바텀시트는 ✕ 버튼 또는 오버레이 클릭으로만 닫힘
  - 개선: 거래 입력 폼(TransactionForm)과 동일하게 핸들 바를 드래그 다운하여 닫기 가능하도록 구현
  - TransactionForm의 드래그 로직(`touchstart`, `touchmove`, `touchend` 처리)을 CalendarTab 바텀시트에도 적용

**완료 체크리스트**
- [ ] E2E 테스트 코드 작성
- [ ] E2E 테스트 전체 통과
- [ ] 공부용 Documents 파일 작성 (`Documents/22-phase14-1-common-ux.md`)

---

### Phase 14.2: 더보기 탭 기능 보강 ✅ 완료

- [x] **아코디언 단일 열림 — 다른 항목 클릭 시 이전 항목 자동 닫힘**
  - 현재: PIN 변경, 예산 설정, 카테고리 관리 각각 독립적으로 열리고 닫힘
  - 문제: 여러 항목을 동시에 펼친 상태로 남을 수 있어 화면이 복잡해짐
  - 개선: 하나의 항목을 열면 이전에 열려 있던 항목은 자동으로 닫힘 (accordion single-open 패턴)
  - 구현: `MoreTab.tsx`에서 `openSection` 상태를 `string | null` 단일 값으로 관리
    - 현재: 각 섹션이 독립적인 `boolean` 상태 (`showPinChange`, `showBudget` 등)
    - 변경: `const [openSection, setOpenSection] = useState<string | null>(null)`
    - 클릭 시: 같은 섹션이면 닫기(`null`), 다른 섹션이면 해당 섹션만 열기
- [x] **거래 데이터 초기화 — PIN 확인 후 전체 삭제**
  - 기능: 더보기 탭에 "데이터 초기화" 메뉴 추가, PIN 인증 통과 후 모든 거래 내역을 삭제
  - 사용 흐름:
    1. 더보기 탭 → "데이터 초기화" 항목 클릭 → 아코디언 펼침
    2. "초기화하려면 PIN을 입력하세요" 안내 문구 + PIN 입력 패드(4자리) 표시
    3. 올바른 PIN 입력 시 → 최종 확인 다이얼로그 ("모든 거래 내역이 삭제됩니다. 계속하시겠습니까?")
    4. 확인 → `DELETE /transactions/all` API 호출 → 성공 시 "초기화 완료" 메시지 표시
    5. 잘못된 PIN → "PIN이 올바르지 않습니다" 오류 메시지
  - 백엔드: `DELETE /transactions/all` 엔드포인트 신규 추가 필요
    - Firestore에서 해당 사용자의 `transactions` 컬렉션 전체 문서 일괄 삭제 (`batch delete`)
  - 프론트: PIN 입력 UI는 기존 `PinInput` 컴포넌트 재사용 (또는 인라인 숫자 패드 구현)
  - 보안: 단순 확인 클릭이 아닌 PIN 재입력을 통한 2단계 인증으로 실수 방지
  - 초기화 후 홈/달력/통계 탭 데이터도 자동 갱신 (`refreshKey` 증가)

**완료 체크리스트**
- [x] E2E 테스트 코드 작성
- [x] E2E 테스트 전체 통과 (366/366)
- [x] 공부용 Documents 파일 작성 (`Documents/23-phase14-2-more-tab.md`)

---

### Phase 14.3: 홈 탭 기능 보강 ✅ 완료

- [x] **날짜 헤더 아래 구분선 추가**
  - 현재: 날짜 헤더(날짜 + 수입/지출 금액)와 그 아래 거래 항목 사이에 시각적 구분이 없음
  - 개선: 통계 탭의 "내용 | 건수 | 금액" 헤더처럼 날짜 헤더 아래에 얇은 밑줄(구분선) 추가
  - 날짜 단위로 항목이 묶여 있음을 시각적으로 명확히 표현
- [x] **날짜 헤더 — 일별 잔액 표시**
  - 현재: 날짜 헤더 우측에 수입(+) / 지출(-) 금액만 표시
  - 개선: 두 금액 뒤에 순수익(수입 - 지출) 최종 금액도 함께 표시
  - 예) `+¥250,000  -¥1,500  = ¥248,500`
- [x] **거래 항목 — 메모 텍스트 표시 (말줄임 처리)**
  - 현재: 카테고리 칩만 표시, 메모란 입력 내용이 목록에 보이지 않음
  - 개선: 카테고리 칩과 금액 사이 영역에 메모 내용 표시
  - 긴 메모는 일정 길이 이후 `...` 말줄임 처리 (예: `"학원비 납..."`)
  - CSS `truncate` (overflow: hidden + text-overflow: ellipsis) 활용
- [x] **거래 항목 클릭 — 상세 보기 / 수정 / 삭제 UI**
  - 거래 항목 행을 탭하면 바텀 시트 또는 모달로 상세 내역 표시
  - 상세 화면 구성:
    - 날짜, 유형(수입/지출), 카테고리, 금액, 메모 전체 내용 표시
    - [수정] 버튼: 기존 TransactionForm을 수정 모드로 재사용 (입력 필드 프리필)
    - [삭제] 버튼: 확인 다이얼로그 후 `DELETE /transactions/:id` API 호출
    - 수정/삭제 완료 후 `refreshKey` 증가로 목록 자동 갱신
  - 백엔드 `PUT /transactions/:id`, `DELETE /transactions/:id` API는 이미 구현 완료

**완료 체크리스트**
- E2E: 386/386 passing
- [x] 공부용 Documents 파일 작성 (`Documents/24-phase14-3-home-tab.md`)
- [ ] **Firestore 실시간 연동 (`onSnapshot`)**
  - 현재 방식 (fetch + refreshKey): 사용자가 저장 버튼을 누를 때만 목록을 다시 불러옴
  - onSnapshot 방식: Firestore DB가 바뀌는 순간 자동으로 화면이 갱신됨 (WebSocket 유사)
  - 왜 지금은 어려운가:
    - 현재 구조: 프론트 → 백엔드 API → Firestore (프론트가 Firestore를 직접 보지 못함)
    - Vercel 서버리스 함수는 최대 30초 타임아웃 → 장시간 연결 유지 불가
  - 구현 방향:
    - 방법 A: 프론트에 Firebase 클라이언트 SDK 직접 추가 → 보안·인증 분리 원칙 재검토 필요
    - 방법 B: 백엔드에서 SSE(Server-Sent Events) 구현 → Cloud Run은 가능하나 아키텍처 변경 필요
  - 다중 기기 동시 사용 또는 가족 공유 기능이 필요해지면 그때 도입 검토

**완료 체크리스트**
- [ ] E2E 테스트 코드 작성
- [ ] E2E 테스트 전체 통과
- [ ] 공부용 Documents 파일 작성 (`Documents/24-phase14-3-home-tab.md`)

### Phase 15: 버그 수정 + iOS Safari Pull-to-Refresh 충돌 해결

#### 15-1. 버그 수정 ✅ 완료

- [x] **거래 추가 시 메모가 저장되지 않는 버그**
  - 원인: `POST /transactions` 라우트에서 `memo` 필드를 destructure하지 않아 `createTransaction` 호출 시 누락
  - 수정: `src/routes/transactions.ts` — `memo` destructure 추가, `createTransaction({ ..., memo })` 전달
  - 수정: `src/services/firestore.ts` — `Transaction` 인터페이스에 `memo?: string` 추가
  - 참고: `PUT /transactions/:id` (수정)는 `req.body` 전체를 전달해 영향 없었음

- [x] **홈 탭 카테고리 칩 너비 불일치 — 메모 시작 위치가 제각각**
  - 원인: 카테고리 칩이 텍스트 길이에 따라 자동 너비 → "식비"(2자), "공과금"(3자) 간 너비 차이
  - 수정: `frontend/src/components/features/home/HomeTab.tsx` — 칩에 `min-w-[3.5rem] inline-flex justify-center` 적용
  - 결과: 모든 카테고리 칩이 최소 56px로 통일, 메모 텍스트 시작 위치 일정

**완료 체크리스트**
- E2E: 386/386 passing

#### 15-2. iOS Safari Pull-to-Refresh 충돌 해결 ✅ 완료

**발생 상황:**
- iPhone Safari에서 거래 입력 모달(바텀시트)을 아래로 드래그할 때
  iOS Safari의 네이티브 **Pull-to-Refresh** (당겨서 새로고침) 제스처가 먼저 발동됨
- 모달을 닫으려는 드래그 중 모달이 아닌 **뒤 페이지 전체가 아래로 밀리며 새로고침** 동작
- 결과: 모달 drag-to-close가 의도대로 작동하지 않음

**원인:**
- 아이폰 Safari는 페이지 최상단에서 아래로 스와이프하면 페이지를 새로고침함
- `touchmove` + `preventDefault()`로 일반 스크롤은 막을 수 있지만,
  iOS 네이티브 Pull-to-Refresh는 별도 레이어에서 처리되어 `preventDefault()`만으로 완전히 차단이 어려움

**해결:**
- `document.body.style.overscrollBehavior = 'none'` — 모달 마운트 시 설정, 언마운트 시 `''` 복원
- 적용 대상: `TransactionForm`, `HomeTab` 거래 상세 시트, `CalendarTab` 날짜 상세 시트
- `CalendarTab`에 누락됐던 `sheetRef` + `touchmove` 배경 스크롤 방어도 함께 추가

**완료 체크리스트**
- E2E: 400/400 passing (`tests/ios-overscroll.spec.ts` 14개 신규)
- [ ] 공부용 Documents 파일 작성

### Phase 16: 통계 탭 카테고리 상세 보기 ✅ 완료
- [x] **카테고리 항목 클릭 시 상세 내역 표시**
  - 현재: 통계 탭에서 "식비", "쇼핑" 등 카테고리 행은 클릭해도 반응 없음
  - 개선: 카테고리 행을 탭하면 해당 카테고리에 속한 개별 거래 목록을 바텀시트로 표시
  - 상세 내역 구성:
    - 헤더: 카테고리명 + 해당 월 합계 금액 (예: "식비 -¥15,000")
    - 거래 목록: 날짜(M월 D일 요일) / 금액 / 메모 — 날짜 내림차순 정렬
    - 닫기: ✕ 버튼 / 오버레이 클릭 / 드래그 다운
  - 구현: 방법 A (CalendarTab 바텀시트 구조 재사용)
  - 수입/지출 탭 전환 시 시트 자동 닫힘
  - iOS Pull-to-Refresh 방지 + touchmove 배경 스크롤 차단 포함
  - 수입/지출 탭 토글 z-index를 z-[60]으로 올려 시트 오버레이(z-40) 위에서도 탭 전환 가능

**완료 체크리스트**
- E2E: 400 → 422/422 passing (`stats-tab.spec.ts` 22개 신규)
- [ ] 공부용 Documents 파일 작성

### Phase 17: 알림 기능 (LINE / 카카오톡 연동)
- [ ] **더보기 탭 — 알림 어카운트 등록 메뉴 추가**
  - LINE 또는 카카오톡 어카운트를 최대 5개까지 등록 가능
  - 등록 정보: 플랫폼(LINE/카카오톡), 어카운트 식별자(토큰 또는 ID)
  - Firestore `notification_accounts` 컬렉션에 저장
  - 백엔드 API(`GET/POST/DELETE /notification-accounts`) 추가 필요
- [ ] **거래 저장 시 알림 발송**
  - `POST /transactions` 처리 완료 후 등록된 어카운트로 알림 메시지 전송
  - LINE: LINE Notify 또는 LINE Messaging API 사용
  - 카카오톡: 카카오 알림톡 또는 카카오 오픈채팅 Bot API 사용
  - 알림 메시지 내용 예시:
    ```
    [가계부 알림]
    💰 수입 +¥250,000 (급여)
    2026-06-18 등록
    ```
- [ ] **알림 발송 실패 처리**
  - 알림 발송 실패 시 거래 저장 자체는 정상 완료 (알림은 부가 기능)
  - 실패 로그는 백엔드에서 기록

**완료 체크리스트**
- [ ] E2E 테스트 코드 작성
- [ ] E2E 테스트 전체 통과
- [ ] 공부용 Documents 파일 작성

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
