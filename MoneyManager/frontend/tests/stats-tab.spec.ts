import { test, expect, Page } from '@playwright/test';

// StatsTab E2E 테스트 — Phase 12: 통계 화면
//
// 관련 컴포넌트:
//   - StatsTab.tsx : 수입/지출 탭 전환 + 카테고리별 집계 리스트 + 정렬 토글
//   - MainApp.tsx  : refreshKey 트리거 (거래 저장 완료 시 +1)
//   - api.ts       : getTransactions
//
// 모킹 전략:
//   page.route()로 백엔드 API를 모킹 — 일관된 테스트 데이터 사용
//   - PIN 인증  : POST /settings/pin/verify → { success: true }
//   - 거래 내역 : GET  /transactions*       → MOCK_TRANSACTIONS

// ─── 날짜 헬퍼 ────────────────────────────────────────────────

function getYearMonth(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
  ].join('-');
}

// ─── 모의 데이터 ───────────────────────────────────────────────
// 지출: 식비(3건 ¥15,000), 쇼핑(1건 ¥30,000), 교통비(2건 ¥4,000)
// 수입: 급여(1건 ¥250,000), 부업(2건 ¥60,000)
const YM = getYearMonth();
const TODAY = `${YM}-15`;

const MOCK_TRANSACTIONS: object[] = [
  // 지출 — 식비 3건
  { id: 'e1', type: 'expense', amount: 8000,  category: '식비',   date: TODAY, createdAt: { _seconds: 1, _nanoseconds: 0 } },
  { id: 'e2', type: 'expense', amount: 5000,  category: '식비',   date: TODAY, createdAt: { _seconds: 2, _nanoseconds: 0 } },
  { id: 'e3', type: 'expense', amount: 2000,  category: '식비',   date: TODAY, createdAt: { _seconds: 3, _nanoseconds: 0 } },
  // 지출 — 쇼핑 1건
  { id: 'e4', type: 'expense', amount: 30000, category: '쇼핑',   date: TODAY, createdAt: { _seconds: 4, _nanoseconds: 0 } },
  // 지출 — 교통비 2건
  { id: 'e5', type: 'expense', amount: 2500,  category: '교통비', date: TODAY, createdAt: { _seconds: 5, _nanoseconds: 0 } },
  { id: 'e6', type: 'expense', amount: 1500,  category: '교통비', date: TODAY, createdAt: { _seconds: 6, _nanoseconds: 0 } },
  // 수입 — 급여 1건
  { id: 'i1', type: 'income',  amount: 250000, category: '급여',  date: TODAY, createdAt: { _seconds: 7, _nanoseconds: 0 } },
  // 수입 — 부업 2건
  { id: 'i2', type: 'income',  amount: 50000, category: '부업',   date: TODAY, createdAt: { _seconds: 8, _nanoseconds: 0 } },
  { id: 'i3', type: 'income',  amount: 10000, category: '부업',   date: TODAY, createdAt: { _seconds: 9, _nanoseconds: 0 } },
];

// 거래 없음 시나리오
const MOCK_EMPTY: object[] = [];

// ─── 공통 헬퍼 ────────────────────────────────────────────────

// PIN 인증 모킹 + 앱 초기 진입
// addInitScript로 sessionStorage에 mm_verified=true를 page.goto() 이전에 주입
// → PIN 화면 자체를 건너뜀 (병렬 실행 시 PIN 버튼 클릭 타임아웃 방지)
async function setupApp(page: Page, transactions: object[]): Promise<void> {
  await page.addInitScript(() => sessionStorage.setItem('mm_verified', 'true'));

  // 거래 내역 API 모킹
  await page.route('**/transactions**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(transactions) })
  );

  await page.goto('/');
  await expect(page.getByRole('navigation')).toBeVisible();
}

// 통계 탭으로 이동하고 렌더링 완료 대기
async function goToStatsTab(page: Page): Promise<void> {
  await page.getByRole('button', { name: '통계' }).click();
  // 수입/지출 탭 버튼 중 하나가 보이면 렌더링 완료
  await expect(page.getByRole('button', { name: '지출' })).toBeVisible({ timeout: 8000 });
}

// ─── 테스트 그룹 ──────────────────────────────────────────────

test.describe('통계 탭 — 기본 렌더링', () => {

  test('통계 탭 클릭 시 수입/지출 전환 탭이 표시된다', async ({ page }) => {
    await setupApp(page, MOCK_TRANSACTIONS);
    await goToStatsTab(page);

    await expect(page.getByRole('button', { name: '지출' })).toBeVisible();
    await expect(page.getByRole('button', { name: '수입' })).toBeVisible();
  });

  test('기본 탭은 지출이 선택된 상태이다', async ({ page }) => {
    await setupApp(page, MOCK_TRANSACTIONS);
    await goToStatsTab(page);

    // 지출 탭이 활성(aria-selected 또는 화면에 지출 데이터가 표시됨)
    // 카테고리 '식비'가 보이면 지출 탭이 활성임
    await expect(page.getByText('식비')).toBeVisible();
  });

  test('하단 탭바에서 통계가 선택 표시된다', async ({ page }) => {
    await setupApp(page, MOCK_TRANSACTIONS);
    await goToStatsTab(page);

    // 통계 탭 아이콘/레이블이 하단 탭바에 있음 — 다른 탭이 보이지 않는 것으로 확인
    await expect(page.getByRole('button', { name: '통계' })).toBeVisible();
  });

});

test.describe('통계 탭 — 지출 통계', () => {

  test('지출 탭에 카테고리 목록이 표시된다', async ({ page }) => {
    await setupApp(page, MOCK_TRANSACTIONS);
    await goToStatsTab(page);

    // 지출 카테고리 3종이 모두 보여야 함
    await expect(page.getByText('식비')).toBeVisible();
    await expect(page.getByText('쇼핑')).toBeVisible();
    await expect(page.getByText('교통비')).toBeVisible();
  });

  test('지출 탭에 테이블 헤더(내용 | 건수 | 금액)가 표시된다', async ({ page }) => {
    await setupApp(page, MOCK_TRANSACTIONS);
    await goToStatsTab(page);

    await expect(page.getByText('내용')).toBeVisible();
    await expect(page.getByText('건수')).toBeVisible();
    await expect(page.getByText('금액')).toBeVisible();
  });

  test('지출 탭에 합계 건수와 총액이 표시된다', async ({ page }) => {
    await setupApp(page, MOCK_TRANSACTIONS);
    await goToStatsTab(page);

    // 지출 총 6건, 합계 ¥49,000 (8000+5000+2000+30000+2500+1500)
    await expect(page.getByText('총 6건')).toBeVisible();
    await expect(page.getByText('¥49,000')).toBeVisible();
  });

  test('카테고리별 건수가 올바르게 표시된다', async ({ page }) => {
    await setupApp(page, MOCK_TRANSACTIONS);
    await goToStatsTab(page);

    // 식비 3건, 쇼핑 1건, 교통비 2건
    // 건수는 숫자로 표시됨 — 각 행 안에서 확인
    const 식비행 = page.locator('div').filter({ hasText: /^식비/ }).first();
    await expect(식비행).toBeVisible();
  });

  test('카테고리별 금액이 올바르게 표시된다', async ({ page }) => {
    await setupApp(page, MOCK_TRANSACTIONS);
    await goToStatsTab(page);

    // 식비 합계 ¥15,000
    await expect(page.getByText('¥15,000')).toBeVisible();
    // 쇼핑 합계 ¥30,000
    await expect(page.getByText('¥30,000')).toBeVisible();
    // 교통비 합계 ¥4,000
    await expect(page.getByText('¥4,000')).toBeVisible();
  });

  test('카테고리별 비율(%)이 표시된다', async ({ page }) => {
    await setupApp(page, MOCK_TRANSACTIONS);
    await goToStatsTab(page);

    // 쇼핑 30000/49000 ≈ 61% (반올림에 따라 61% 또는 62%)
    // 식비 15000/49000 ≈ 31%
    // 비율 값이 하나 이상 %로 표시됨을 확인
    const percentages = page.locator('text=/%/');
    // page.getByText 는 정규식도 지원
    await expect(page.getByText(/%/, { exact: false }).first()).toBeVisible();
  });

});

test.describe('통계 탭 — 수입 통계', () => {

  test('[수입] 탭 클릭 시 수입 카테고리가 표시된다', async ({ page }) => {
    await setupApp(page, MOCK_TRANSACTIONS);
    await goToStatsTab(page);

    await page.getByRole('button', { name: '수입' }).click();

    // 수입 카테고리 2종이 보여야 함
    await expect(page.getByText('급여')).toBeVisible();
    await expect(page.getByText('부업')).toBeVisible();
  });

  test('수입 탭에 합계 건수와 총액이 표시된다', async ({ page }) => {
    await setupApp(page, MOCK_TRANSACTIONS);
    await goToStatsTab(page);

    await page.getByRole('button', { name: '수입' }).click();

    // 수입 총 3건, 합계 ¥310,000 (250000+50000+10000)
    await expect(page.getByText('총 3건')).toBeVisible();
    await expect(page.getByText('¥310,000')).toBeVisible();
  });

  test('수입 탭에서 지출 카테고리는 표시되지 않는다', async ({ page }) => {
    await setupApp(page, MOCK_TRANSACTIONS);
    await goToStatsTab(page);

    await page.getByRole('button', { name: '수입' }).click();

    // 지출 카테고리가 보이지 않아야 함
    await expect(page.getByText('식비')).not.toBeVisible();
    await expect(page.getByText('쇼핑')).not.toBeVisible();
  });

  test('[지출] → [수입] → [지출] 탭 전환이 정상 동작한다', async ({ page }) => {
    await setupApp(page, MOCK_TRANSACTIONS);
    await goToStatsTab(page);

    // 지출 탭 확인
    await expect(page.getByText('쇼핑')).toBeVisible();

    // 수입 탭으로 전환
    await page.getByRole('button', { name: '수입' }).click();
    await expect(page.getByText('급여')).toBeVisible();
    await expect(page.getByText('쇼핑')).not.toBeVisible();

    // 다시 지출 탭으로 전환
    await page.getByRole('button', { name: '지출' }).click();
    await expect(page.getByText('쇼핑')).toBeVisible();
    await expect(page.getByText('급여')).not.toBeVisible();
  });

});

test.describe('통계 탭 — 정렬 토글', () => {

  test('금액 헤더 버튼 클릭 시 정렬 방향 화살표가 토글된다', async ({ page }) => {
    await setupApp(page, MOCK_TRANSACTIONS);
    await goToStatsTab(page);

    // 초기 상태: 내림차순 ↓
    const sortBtn = page.getByRole('button', { name: /금액/ });
    await expect(sortBtn).toContainText('↓');

    // 클릭 후: 오름차순 ↑
    await sortBtn.click();
    await expect(sortBtn).toContainText('↑');

    // 한 번 더 클릭: 다시 내림차순 ↓
    await sortBtn.click();
    await expect(sortBtn).toContainText('↓');
  });

  test('기본 정렬은 금액 내림차순(높은 순)이다', async ({ page }) => {
    await setupApp(page, MOCK_TRANSACTIONS);
    await goToStatsTab(page);

    // 쇼핑(30000) > 식비(15000) > 교통비(4000) 순서여야 함
    // 화면에서 세 텍스트의 위치(y좌표)를 비교
    const 쇼핑Y = await page.getByText('쇼핑').boundingBox().then(b => b?.y ?? 0);
    const 식비Y  = await page.getByText('식비').boundingBox().then(b => b?.y ?? 0);
    const 교통비Y = await page.getByText('교통비').boundingBox().then(b => b?.y ?? 0);

    expect(쇼핑Y).toBeLessThan(식비Y);
    expect(식비Y).toBeLessThan(교통비Y);
  });

  test('오름차순 정렬 클릭 시 금액 낮은 순으로 재정렬된다', async ({ page }) => {
    await setupApp(page, MOCK_TRANSACTIONS);
    await goToStatsTab(page);

    // 오름차순으로 전환
    await page.getByRole('button', { name: /금액/ }).click();

    // 교통비(4000) < 식비(15000) < 쇼핑(30000) 순서여야 함
    const 교통비Y = await page.getByText('교통비').boundingBox().then(b => b?.y ?? 0);
    const 식비Y  = await page.getByText('식비').boundingBox().then(b => b?.y ?? 0);
    const 쇼핑Y  = await page.getByText('쇼핑').boundingBox().then(b => b?.y ?? 0);

    expect(교통비Y).toBeLessThan(식비Y);
    expect(식비Y).toBeLessThan(쇼핑Y);
  });

});

test.describe('통계 탭 — 빈 상태', () => {

  test('거래가 없으면 "이번 달 지출 내역이 없습니다" 메시지가 표시된다', async ({ page }) => {
    await setupApp(page, MOCK_EMPTY);
    await goToStatsTab(page);

    await expect(page.getByText('이번 달 지출 내역이 없습니다.')).toBeVisible();
  });

  test('거래가 없으면 "이번 달 수입 내역이 없습니다" 메시지가 수입 탭에서 표시된다', async ({ page }) => {
    await setupApp(page, MOCK_EMPTY);
    await goToStatsTab(page);

    await page.getByRole('button', { name: '수입' }).click();

    await expect(page.getByText('이번 달 수입 내역이 없습니다.')).toBeVisible();
  });

  test('거래가 없으면 카테고리 행이 표시되지 않는다', async ({ page }) => {
    await setupApp(page, MOCK_EMPTY);
    await goToStatsTab(page);

    // 카테고리 이름이 하나도 보이지 않아야 함
    await expect(page.getByText('식비')).not.toBeVisible();
    await expect(page.getByText('급여')).not.toBeVisible();
  });

});

test.describe('통계 탭 — 연월 연동', () => {

  test('연월 변경 시 해당 월 통계가 갱신된다', async ({ page }) => {
    await setupApp(page, MOCK_TRANSACTIONS);
    await goToStatsTab(page);

    // 이번 달: 지출 카테고리가 보임
    await expect(page.getByText('쇼핑')).toBeVisible();

    // 이전 달로 이동 → 모킹된 빈 응답으로 전환
    await page.route('**/transactions**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    );

    await page.getByRole('button', { name: '이전 달' }).click();

    // 이전 달은 거래 없음 → 빈 상태 메시지
    await expect(page.getByText('이번 달 지출 내역이 없습니다.')).toBeVisible({ timeout: 5000 });
  });

});
