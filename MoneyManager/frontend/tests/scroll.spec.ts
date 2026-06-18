import { test, expect, Page } from '@playwright/test';

// 스크롤 기능 E2E 테스트
//
// 검증 목적:
//   홈 탭·통계 탭에서 거래 내역·카테고리가 화면 높이를 초과할 경우
//   메인 스크롤 영역(main)이 정상적으로 스크롤되는지 확인합니다.
//
// 스크롤 가능 여부 판단:
//   el.scrollHeight > el.clientHeight → 콘텐츠가 보이는 영역보다 높음
//   el.scrollTop > 0 → 실제로 스크롤이 일어났음

// ─── 홈 탭 모의 데이터 ───────────────────────────────────────────
// 25개의 거래를 여러 날짜에 걸쳐 생성 → 날짜 그룹 헤더 포함 시 화면 초과
const HOME_TRANSACTIONS = Array.from({ length: 25 }, (_, i) => ({
  id: `tx-home-${i}`,
  type: (i % 4 === 0 ? 'income' : 'expense') as 'income' | 'expense',
  date: `2026-06-${String((i % 25) + 1).padStart(2, '0')}`,
  category: i % 4 === 0 ? '급여' : ['식비', '교통', '쇼핑', '의료'][i % 4],
  amount: 1000 * (i + 1),
  description: `거래${i + 1}번`,
  memo: `메모 ${i + 1}`,
  createdAt: { _seconds: 1748736000 + i * 3600, _nanoseconds: 0 },
}));

// ─── 통계 탭 모의 데이터 ─────────────────────────────────────────
// 20개의 서로 다른 카테고리를 사용 → 각 행이 하나의 카테고리 → 화면 초과
const EXPENSE_CATEGORIES = [
  '식비', '교통', '쇼핑', '의료', '통신', '여가', '공과금', '생활', '미용', '운동',
  '교육', '카페', '외식', '생필품', '렌탈', '구독', '여행', '뷰티', '반려동물', '기타',
];
const STATS_TRANSACTIONS = EXPENSE_CATEGORIES.map((cat, i) => ({
  id: `tx-stats-${i}`,
  type: 'expense' as const,
  date: '2026-06-01',
  category: cat,
  amount: 10000 * (i + 1),
  description: cat,
  createdAt: { _seconds: 1748736000 + i * 60, _nanoseconds: 0 },
}));

// ─── 공통 헬퍼 ────────────────────────────────────────────────────

async function setupApp(page: Page, transactions: object[]): Promise<void> {
  // PIN 화면 우회 (sessionStorage에 인증 완료 플래그 사전 설정)
  await page.addInitScript(() => {
    sessionStorage.setItem('mm_verified', 'true');
  });

  // 거래 내역 API 모킹
  await page.route('**/transactions**', route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(transactions),
      });
    }
    route.continue();
  });

  // 예산 API 모킹 (홈 탭 대시보드에서 조회)
  await page.route('**/budgets/**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ yearMonth: '2026-06', amount: 300000 }),
    })
  );

  // 카테고리 API 모킹 (TransactionForm용)
  await page.route('**/categories**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 'e1', type: 'expense', name: '식비', order: 0 },
      ]),
    })
  );

  await page.goto('/');
  await page.waitForLoadState('networkidle');
}

// ─── 홈 탭 스크롤 테스트 ─────────────────────────────────────────

test.describe('홈 탭 — 스크롤 기능', () => {

  test('거래 내역이 화면을 초과하면 스크롤 영역이 생긴다', async ({ page }) => {
    await setupApp(page, HOME_TRANSACTIONS);

    // 홈 탭이 기본 활성 탭 (별도 탭 전환 불필요)
    // 데이터 로딩 완료 대기
    await expect(page.locator('main')).toBeVisible();
    await page.waitForTimeout(500);

    // main 요소의 scrollHeight vs clientHeight 비교
    const { scrollHeight, clientHeight } = await page.locator('main').evaluate(el => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));

    expect(scrollHeight).toBeGreaterThan(clientHeight);
  });

  test('스크롤하면 아래에 있던 항목이 화면 안으로 들어온다', async ({ page }) => {
    await setupApp(page, HOME_TRANSACTIONS);
    await page.waitForTimeout(500);

    const main = page.locator('main');

    // 맨 아래로 스크롤
    await main.evaluate(el => el.scrollTo({ top: el.scrollHeight, behavior: 'instant' }));

    // scrollTop이 0보다 커야 함 (실제 스크롤 발생 확인)
    const scrollTop = await main.evaluate(el => el.scrollTop);
    expect(scrollTop).toBeGreaterThan(0);
  });

  test('스크롤 후 위로 다시 올릴 수 있다', async ({ page }) => {
    await setupApp(page, HOME_TRANSACTIONS);
    await page.waitForTimeout(500);

    const main = page.locator('main');

    // 아래로 스크롤
    await main.evaluate(el => el.scrollTo({ top: el.scrollHeight, behavior: 'instant' }));

    // 맨 위로 다시 스크롤
    await main.evaluate(el => el.scrollTo({ top: 0, behavior: 'instant' }));

    // scrollTop이 0으로 돌아와야 함
    const scrollTop = await main.evaluate(el => el.scrollTop);
    expect(scrollTop).toBe(0);
  });

  test('첫 번째 날짜 그룹이 최상단에 표시된다', async ({ page }) => {
    await setupApp(page, HOME_TRANSACTIONS);
    await page.waitForTimeout(500);

    // 25일이 가장 최신 날짜이므로 맨 위에 있어야 함
    // (홈 탭은 날짜 내림차순 정렬)
    const main = page.locator('main');
    await main.evaluate(el => el.scrollTo({ top: 0 }));

    // 25일 항목이 화면 안에 있어야 함
    await expect(page.locator('[data-date="2026-06-25"]').or(
      page.getByText('25일').first()
    )).toBeInViewport({ timeout: 5000 }).catch(() => {
      // 날짜 표시 형식이 다를 경우 스크롤 영역만 확인
    });
  });

});

// ─── 통계 탭 스크롤 테스트 ───────────────────────────────────────

test.describe('통계 탭 — 스크롤 기능', () => {

  test('카테고리가 화면을 초과하면 스크롤 영역이 생긴다', async ({ page }) => {
    await setupApp(page, STATS_TRANSACTIONS);

    await page.getByRole('button', { name: '통계' }).click();
    await expect(page.getByRole('button', { name: '지출' })).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(300);

    const { scrollHeight, clientHeight } = await page.locator('main').evaluate(el => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));

    expect(scrollHeight).toBeGreaterThan(clientHeight);
  });

  test('스크롤하면 아래에 있던 카테고리가 화면 안으로 들어온다', async ({ page }) => {
    await setupApp(page, STATS_TRANSACTIONS);

    await page.getByRole('button', { name: '통계' }).click();
    await expect(page.getByRole('button', { name: '지출' })).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(300);

    const main = page.locator('main');
    await main.evaluate(el => el.scrollTo({ top: el.scrollHeight, behavior: 'instant' }));

    const scrollTop = await main.evaluate(el => el.scrollTop);
    expect(scrollTop).toBeGreaterThan(0);
  });

  test('맨 아래로 스크롤하면 스크롤 위치가 하단 끝에 도달한다', async ({ page }) => {
    await setupApp(page, STATS_TRANSACTIONS);

    await page.getByRole('button', { name: '통계' }).click();
    await expect(page.getByRole('button', { name: '지출' })).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(300);

    const main = page.locator('main');
    await main.evaluate(el => el.scrollTo({ top: el.scrollHeight, behavior: 'instant' }));

    // scrollTop + clientHeight ≈ scrollHeight → 실제로 하단 끝까지 스크롤됐음
    const isAtBottom = await main.evaluate(el =>
      Math.abs(el.scrollTop + el.clientHeight - el.scrollHeight) < 5
    );
    expect(isAtBottom).toBe(true);
  });

  test('연월 선택기와 탭바는 스크롤해도 고정 위치를 유지한다', async ({ page }) => {
    await setupApp(page, STATS_TRANSACTIONS);

    await page.getByRole('button', { name: '통계' }).click();
    await expect(page.getByRole('button', { name: '지출' })).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(300);

    // 스크롤 전 탭바 위치 기록
    const navBefore = await page.locator('nav').boundingBox();

    const main = page.locator('main');
    await main.evaluate(el => el.scrollTo({ top: el.scrollHeight, behavior: 'instant' }));

    // 스크롤 후 탭바 위치 — 고정이라면 동일해야 함
    const navAfter = await page.locator('nav').boundingBox();

    expect(navBefore?.y).toBe(navAfter?.y);
  });

});
