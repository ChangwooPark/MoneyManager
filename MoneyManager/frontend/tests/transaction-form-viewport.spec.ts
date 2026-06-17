import { test, expect, Page } from '@playwright/test';

// FAB 버튼 클릭 시 열리는 내역 추가 모달의 날짜 입력란 뷰포트 표시 테스트
//
// 재현 환경:
//   - 아이폰의 크롬 브라우저에서 FAB 버튼 클릭 후 모달 내 날짜 입력란이 화면 밖으로 벗어남
//   - iPhone 14 뷰포트(390×664)와 소형 뷰포트(390×553)로 시뮬레이션
//
// 관련 컴포넌트:
//   - MainApp.tsx        : FAB 버튼(aria-label="거래 추가"), showForm 상태
//   - TransactionForm.tsx : fixed inset-0 z-50, max-height 90vh, overflow-y-auto
//
// WebKit(Mobile Safari) 제외 이유:
//   - 로컬 WebKit 바이너리가 Bus error로 충돌 → chromium / Mobile Chrome 으로만 검증

// ── 헬퍼: PIN API 모킹 후 메인 앱으로 이동 ──────────────────────
async function goToMainApp(page: Page): Promise<void> {
  // PIN 검증 API를 항상 성공으로 모킹 (실제 PIN 값 불필요)
  await page.route('**/settings/pin/verify', route =>
    route.fulfill({ json: { success: true } })
  );
  await page.goto('/');
  for (const num of ['1', '2', '3', '4']) {
    await page.getByRole('button', { name: num, exact: true }).click();
  }
  // 하단 내비게이션이 뜰 때까지 대기 (메인 앱 진입 확인)
  await expect(page.getByRole('navigation')).toBeVisible();
}

// ── 헬퍼: FAB 버튼 클릭 후 내역 추가 모달 열기 ─────────────────
async function openTransactionForm(page: Page): Promise<void> {
  await page.getByRole('button', { name: '거래 추가' }).click();
  await expect(page.getByRole('heading', { name: '내역 추가' })).toBeVisible();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. iPhone 14 뷰포트 (390×664) — Playwright devices['iPhone 14'] 기준
//    아이폰 크롬 브라우저에서 실제로 콘텐츠가 표시되는 가시 영역과 동일
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
test.describe('FAB 모달 날짜 입력란 — iPhone 14 뷰포트 (390×664)', () => {
  // iPhone 14에서 Safari/Chrome 브라우저 UI를 제외한 실제 가시 영역 크기
  test.use({ viewport: { width: 390, height: 664 } });

  // WebKit 바이너리 충돌(Bus error)로 인해 webkit 제외
  test.skip(({ browserName }) => browserName === 'webkit',
    'WebKit 바이너리 충돌(Bus error)로 건너뜁니다. chromium / Mobile Chrome에서 검증합니다.');

  test.beforeEach(async ({ page }) => {
    await goToMainApp(page);
    await openTransactionForm(page);
  });

  test('날짜 입력란이 뷰포트 안에 완전히 표시된다', async ({ page }) => {
    const dateInput = page.locator('input[type="date"]');

    // Playwright 내장 assertion: 요소가 뷰포트와 교차하는지 확인
    await expect(dateInput).toBeInViewport();

    // getBoundingClientRect로 픽셀 단위 검증
    const result = await dateInput.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      return {
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
        vh,
        isFullyInViewport: rect.top >= 0 && rect.bottom <= vh,
        overflowBottom: Math.max(0, rect.bottom - vh),
      };
    });

    expect(result.top).toBeGreaterThanOrEqual(0);
    expect(result.isFullyInViewport).toBe(true);
    expect(result.overflowBottom).toBe(0);
  });

  test('날짜 레이블("날짜")이 뷰포트 안에 표시된다', async ({ page }) => {
    // 날짜 라벨이 날짜 입력란 위에 보이는지 확인
    await expect(page.locator('label', { hasText: '날짜' }).first()).toBeInViewport();
  });

  test('저장 버튼이 뷰포트 안에 완전히 표시된다', async ({ page }) => {
    const saveButton = page.getByRole('button', { name: '저장' });
    await expect(saveButton).toBeInViewport();

    const result = await saveButton.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      return {
        bottom: Math.round(rect.bottom),
        vh,
        overflowBottom: Math.max(0, rect.bottom - vh),
      };
    });

    expect(result.overflowBottom).toBe(0);
  });

  test('날짜 입력란이 하단 네비게이션 바와 겹치지 않는다', async ({ page }) => {
    // 모달(z-50)이 네비게이션을 시각적으로 덮지만, 날짜 입력란의 DOM 레이아웃 위치 확인
    const dateInput = page.locator('input[type="date"]');
    const nav = page.getByRole('navigation');

    const dateBottom = await dateInput.evaluate(el =>
      Math.round(el.getBoundingClientRect().bottom)
    );
    const navTop = await nav.evaluate(el =>
      Math.round(el.getBoundingClientRect().top)
    );

    // 날짜 입력란 하단이 네비게이션 상단보다 위에 있어야 함
    expect(dateBottom).toBeLessThanOrEqual(navTop);
  });

  test('모달 시트가 뷰포트 높이(664px)를 초과하지 않는다', async ({ page }) => {
    // TransactionForm의 바텀 시트: rounded-t-2xl overflow-y-auto 클래스 사용
    const sheet = page.locator('.rounded-t-2xl').first();
    const result = await sheet.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return {
        height: Math.round(rect.height),
        vh: window.innerHeight,
      };
    });

    // 시트 높이는 뷰포트 높이를 초과할 수 없음 (overflow-y-auto 스크롤 영역)
    expect(result.height).toBeLessThanOrEqual(result.vh);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2. 소형 뷰포트 (390×553) — iPhone SE + Chrome UI 동시 표시 시나리오
//    주소창(~56px) + 하단 탭바(~83px) + 홈 인디케이터(~34px)를 모두 고려한 최소 가시 영역
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
test.describe('FAB 모달 날짜 입력란 — 소형 뷰포트 (390×553)', () => {
  test.use({ viewport: { width: 390, height: 553 } });

  test.skip(({ browserName }) => browserName === 'webkit',
    'WebKit 바이너리 충돌(Bus error)로 건너뜁니다. chromium / Mobile Chrome에서 검증합니다.');

  test.beforeEach(async ({ page }) => {
    await goToMainApp(page);
    await openTransactionForm(page);
  });

  test('날짜 입력란이 소형 뷰포트에서도 뷰포트 안에 표시된다', async ({ page }) => {
    const dateInput = page.locator('input[type="date"]');
    await expect(dateInput).toBeInViewport();

    const result = await dateInput.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      return {
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
        vh,
        isFullyInViewport: rect.top >= 0 && rect.bottom <= vh,
        overflowBottom: Math.max(0, rect.bottom - vh),
      };
    });

    expect(result.isFullyInViewport).toBe(true);
    expect(result.overflowBottom).toBe(0);
  });

  test('소형 뷰포트에서 날짜 입력란이 뷰포트 상단 경계 위로 벗어나지 않는다', async ({ page }) => {
    // 뷰포트가 작을 때 justify-end 레이아웃으로 인해 상단 요소가 밀려 올라가는 현상 검증
    const top = await page.locator('input[type="date"]').evaluate(
      el => Math.round(el.getBoundingClientRect().top)
    );
    // top이 0 이상: 뷰포트 상단 밖으로 벗어나지 않았음
    expect(top).toBeGreaterThanOrEqual(0);
  });

  test('소형 뷰포트에서 모달 내 날짜 입력란을 클릭할 수 있다', async ({ page }) => {
    // 클릭 가능 여부 = 활성화 상태 + 가시 상태 + 뷰포트 내 위치
    const dateInput = page.locator('input[type="date"]');
    await expect(dateInput).toBeEnabled();
    await expect(dateInput).toBeVisible();
    // 실제 클릭이 가능한지 확인 (포커스 이동)
    await dateInput.click();
    await expect(dateInput).toBeFocused();
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3. 표준 모바일 뷰포트 (390×844) — iPhone 14 전체 화면 기준
//    CSS 레이아웃 뷰포트 높이 = window.innerHeight 기준 정상 동작 확인
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
test.describe('FAB 모달 날짜 입력란 — 표준 모바일 뷰포트 (390×844)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.skip(({ browserName }) => browserName === 'webkit',
    'WebKit 바이너리 충돌(Bus error)로 건너뜁니다. chromium / Mobile Chrome에서 검증합니다.');

  test.beforeEach(async ({ page }) => {
    await goToMainApp(page);
    await openTransactionForm(page);
  });

  test('날짜 입력란이 뷰포트 안에 표시된다', async ({ page }) => {
    const dateInput = page.locator('input[type="date"]');
    await expect(dateInput).toBeInViewport();

    const isFullyInViewport = await dateInput.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      return rect.top >= 0 && rect.bottom <= vh;
    });

    expect(isFullyInViewport).toBe(true);
  });

  test('모달 바텀 시트 최대 높이가 뷰포트의 90% 이하로 제한된다', async ({ page }) => {
    // TransactionForm에서 max-height: 90vh 적용 확인
    const sheet = page.locator('.rounded-t-2xl').first();
    const result = await sheet.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return {
        height: Math.round(rect.height),
        vh: window.innerHeight,
      };
    });
    // 부동소수점 오차(1px) 허용
    expect(result.height).toBeLessThanOrEqual(Math.round(result.vh * 0.9) + 1);
  });

  test('모달 열린 후 날짜 입력란의 위치가 상단 월 선택기 아래에 있다', async ({ page }) => {
    // 날짜 입력란이 MonthSelector(이전달/다음달 버튼 포함 상단 영역) 아래에 위치하는지 확인
    const monthSelectorBottom = await page.getByRole('button', { name: '이전 달' })
      .evaluate(el => Math.round(el.getBoundingClientRect().bottom));
    const dateInputTop = await page.locator('input[type="date"]')
      .evaluate(el => Math.round(el.getBoundingClientRect().top));

    // 날짜 입력란 상단이 월 선택기 하단보다 아래에 있어야 함
    expect(dateInputTop).toBeGreaterThan(monthSelectorBottom);
  });
});
