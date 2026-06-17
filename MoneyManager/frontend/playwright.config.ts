import { defineConfig, devices } from '@playwright/test';

// ─── Playwright E2E 테스트 설정 ────────────────────────────────
// 이 파일은 모든 테스트에 적용되는 전역 설정입니다.
// 테스트 실행 전 Next.js 개발 서버를 자동으로 시작합니다.
// 백엔드(Express) 서버는 별도로 실행되어 있어야 합니다.

export default defineConfig({
  // 테스트 파일 위치
  testDir: './tests',

  // 모든 테스트 시작 전 한 번 실행되는 전역 셋업
  // Firestore 콜드 스타트 방지용 백엔드 워밍업 수행
  globalSetup: './tests/global-setup.ts',

  // 테스트 파일을 병렬로 실행 (속도 향상)
  fullyParallel: true,

  // CI 환경에서 test.only가 남아있으면 빌드 실패 처리
  forbidOnly: !!process.env.CI,

  // CI에서는 실패한 테스트를 2번 재시도, 로컬에서는 재시도 없음
  retries: process.env.CI ? 2 : 0,

  // CI에서는 단일 worker로 실행 (리소스 절약)
  workers: process.env.CI ? 1 : undefined,

  // 테스트 결과 리포터: HTML 리포트 생성 (npx playwright show-report 로 확인)
  reporter: [['html', { open: 'never' }]],

  // ── 모든 테스트에 공통 적용되는 설정 ──────────────────────────
  use: {
    // 테스트 대상 URL — page.goto('/') 처럼 상대 경로 사용 가능
    baseURL: 'http://localhost:3000',

    // 테스트 실패 시 스크린샷 자동 저장 (디버깅용)
    screenshot: 'only-on-failure',

    // 재시도 시 trace 수집 (실패 원인 상세 분석용)
    trace: 'on-first-retry',

    // 모바일 퍼스트 앱이므로 기본 뷰포트를 모바일로 설정
    viewport: { width: 390, height: 844 }, // iPhone 14 크기
  },

  // ── 테스트할 브라우저/디바이스 설정 ───────────────────────────
  projects: [
    {
      // 데스크톱 Chrome (가장 일반적인 환경)
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // 모바일 Chrome — 실제 사용 환경과 동일한 뷰포트
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 7'] },
    },
    {
      // 모바일 Safari — iPhone 환경 테스트
      name: 'Mobile Safari',
      use: { ...devices['iPhone 14'] },
    },
  ],

  // ── 테스트 실행 전 서버 자동 시작 ────────────────────────────
  // webServer 배열로 프론트엔드와 백엔드를 모두 자동 시작합니다.
  // 이미 실행 중인 서버가 있으면 재사용합니다(reuseExistingServer).
  //
  // 주의: 백엔드 서버는 Firestore 접근을 위해 GCP 인증이 필요합니다.
  //   gcloud auth application-default login 이 선행되어 있어야 합니다.
  webServer: [
    {
      // 프론트엔드 Next.js 개발 서버
      command: 'npm run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: true,
      timeout: 60000,
    },
    {
      // 백엔드 Express 서버 (MoneyManager/ 루트에서 실행)
      command: 'npm run dev',
      cwd: '../',              // frontend/의 상위 디렉토리 (MoneyManager/)
      url: 'http://localhost:8080/health',
      reuseExistingServer: true,
      timeout: 60000,
    },
  ],
});
