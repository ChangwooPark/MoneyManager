import { test, expect, Page } from '@playwright/test';

// iOS Safari Pull-to-Refresh 방지 E2E 테스트 — Phase 15-2
//
// 테스트 대상:
//   모달/시트가 열릴 때 document.body.style.overscrollBehavior = 'none' 설정되고
//   닫힐 때 '' 로 복원되는지 검증합니다.
//
//   대상 컴포넌트:
//     1. TransactionForm (FAB 클릭 → 거래 입력 폼)
//     2. CalendarTab 날짜 상세 시트
//     3. HomeTab 거래 상세 시트
//
// 검증 방법:
//   page.evaluate(() => document.body.style.overscrollBehavior) 로
//   DOM 스타일 값을 직접 읽습니다.

// ─── 날짜 헬퍼 ─────────────────────────────────────────────────

function getToday(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

const TODAY = getToday();

// ─── 공통 모의 데이터 ─────────────────────────────────────────

// 오늘: 지출(기타, 메모 있음) 1건
const MOCK_TRANSACTIONS: object[] = [
  {
    id: 'tx-1',
    type: 'expense',
    amount: 1500,
    category: '기타',
    description: '주유비',
    date: TODAY,
    memo: '주유비 결제',
    createdAt: { _seconds: 1750250000, _nanoseconds: 0 },
  },
];

// ─── 공통 헬퍼 ───────────────────────────────────────────────

// PIN 인증 모킹 + 앱 진입
async function goToMainApp(page: Page): Promise<void> {
  await page.route('**/settings/pin/verify', route =>
    route.fulfill({ json: { success: true } })
  );
  await page.route('**/transactions*', route => {
    if (route.request().method() === 'GET') {
      route.fulfill({ json: MOCK_TRANSACTIONS });
    } else {
      route.continue();
    }
  });
  await page.route('**/budgets/**', route =>
    route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'Not found' }) })
  );
  await page.goto('/');
  for (const num of ['1', '2', '3', '4']) {
    await page.getByRole('button', { name: num, exact: true }).click();
  }
  await expect(page.getByRole('navigation')).toBeVisible();
}

// overscrollBehavior 값 읽기
async function getOverscroll(page: Page): Promise<string> {
  return page.evaluate(() => document.body.style.overscrollBehavior);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. TransactionForm — FAB 거래 입력 폼
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
test.describe('TransactionForm — overscroll-behavior 관리', () => {
  test.beforeEach(async ({ page }) => {
    await goToMainApp(page);
  });

  test('폼 열기 전에는 overscrollBehavior가 비어 있다', async ({ page }) => {
    const value = await getOverscroll(page);
    expect(value).toBe('');
  });

  test('FAB 클릭으로 폼이 열리면 overscrollBehavior가 none으로 설정된다', async ({ page }) => {
    await page.getByRole('button', { name: '거래 추가' }).click();
    await expect(page.getByRole('heading', { name: '내역 추가' })).toBeVisible();

    const value = await getOverscroll(page);
    expect(value).toBe('none');
  });

  test('✕ 버튼으로 폼을 닫으면 overscrollBehavior가 복원된다', async ({ page }) => {
    await page.getByRole('button', { name: '거래 추가' }).click();
    await expect(page.getByRole('heading', { name: '내역 추가' })).toBeVisible();

    await page.getByRole('button', { name: '✕' }).click();
    await expect(page.getByRole('heading', { name: '내역 추가' })).not.toBeVisible();

    const value = await getOverscroll(page);
    expect(value).toBe('');
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2. CalendarTab — 날짜 상세 시트
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
test.describe('CalendarTab 날짜 시트 — overscroll-behavior 관리', () => {
  test.beforeEach(async ({ page }) => {
    await goToMainApp(page);
    await page.getByRole('button', { name: '달력' }).click();
    await expect(page.locator(`[data-date="${TODAY}"]`)).toBeVisible({ timeout: 8000 });
  });

  test('날짜 셀 클릭으로 시트가 열리면 overscrollBehavior가 none이 된다', async ({ page }) => {
    await page.locator(`[data-date="${TODAY}"]`).click();
    await expect(page.getByRole('button', { name: '닫기' })).toBeVisible();

    const value = await getOverscroll(page);
    expect(value).toBe('none');
  });

  test('✕ 버튼으로 시트를 닫으면 overscrollBehavior가 복원된다', async ({ page }) => {
    await page.locator(`[data-date="${TODAY}"]`).click();
    await expect(page.getByRole('button', { name: '닫기' })).toBeVisible();

    await page.getByRole('button', { name: '닫기' }).click();
    await expect(page.getByRole('button', { name: '닫기' })).not.toBeVisible();

    const value = await getOverscroll(page);
    expect(value).toBe('');
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3. HomeTab — 거래 상세 시트
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
test.describe('HomeTab 거래 시트 — overscroll-behavior 관리', () => {
  test.beforeEach(async ({ page }) => {
    await goToMainApp(page);
  });

  test('거래 항목 클릭으로 시트가 열리면 overscrollBehavior가 none이 된다', async ({ page }) => {
    await page.getByText('주유비 결제').click();
    await expect(page.getByText('거래 상세')).toBeVisible();

    const value = await getOverscroll(page);
    expect(value).toBe('none');
  });

  test('✕ 버튼으로 시트를 닫으면 overscrollBehavior가 복원된다', async ({ page }) => {
    await page.getByText('주유비 결제').click();
    await expect(page.getByText('거래 상세')).toBeVisible();

    await page.getByRole('button', { name: '✕' }).click();
    await expect(page.getByText('거래 상세')).not.toBeVisible();

    const value = await getOverscroll(page);
    expect(value).toBe('');
  });
});
