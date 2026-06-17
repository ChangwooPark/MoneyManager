import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // 테스트 파일 위치
  testDir: './tests',

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

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 14'] },
    },
  ],

  webServer: [
    {
      // 프론트엔드 Next.js 개발 서버
      command: 'npm run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: true,
      timeout: 60000,
    },
    {
      // 백엔드 Express 서버
      command: 'npm run dev',
      cwd: '../',
      url: 'http://localhost:8080/health',
      reuseExistingServer: true,
      timeout: 60000,
    },
  ],
});
