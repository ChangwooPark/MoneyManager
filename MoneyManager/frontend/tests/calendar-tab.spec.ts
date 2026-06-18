import { test, expect, Page } from '@playwright/test';

// CalendarTab E2E 테스트 — Phase 11: 달력 화면
//
// 관련 컴포넌트:
//   - CalendarTab.tsx : 월간 그리드 달력 + 날짜 상세 바텀시트
//   - MainApp.tsx     : refreshKey 트리거 (거래 저장 완료 시 +1)
//   - api.ts          : getTransactions
//
// 모킹 전략:
//   page.route()로 백엔드 API를 모킹 — 일관된 테스트 데이터 사용
//   - PIN 인증  : POST /settings/pin/verify → { success: true }
//   - 거래 내역 : GET  /transactions*       → MOCK_TRANSACTIONS
//
// 날짜 버튼 셀렉터:
//   달력 셀 버튼에는 data-date="YYYY-MM-DD" 속성이 있습니다.
//   page.locator('[data-date="YYYY-MM-DD"]') 으로 정확하게 특정합니다.

// ─── 날짜 헬퍼 ────────────────────────────────────────────────

// 오늘 날짜 YYYY-MM-DD
function getToday(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

// 어제 날짜 YYYY-MM-DD
function getYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

// 이전 연월 레이블 "YYYY년 M월"
function getPrevMonthLabel(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
}

// CalendarTab.tsx의 formatDateHeader와 동일한 로직
// "2026-06-18" → "6월 18일 (목)"
function formatDateHeader(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const dayName = dayNames[new Date(y, m - 1, d).getDay()];
  return `${m}월 ${d}일 (${dayName})`;
}

// CalendarTab.tsx의 formatYenShort와 동일한 로직
// 달력 셀 금액 단축 표기: 250000 → "25万", 1500 → "1.5千", 800 → "¥800"
function formatYenShort(amount: number): string {
  if (amount >= 10000) {
    const man = amount / 10000;
    return `${Number.isInteger(man) ? man : man.toFixed(1)}万`;
  }
  if (amount >= 1000) {
    const sen = amount / 1000;
    return `${Number.isInteger(sen) ? sen : sen.toFixed(1)}千`;
  }
  return `¥${amount}`;
}

const TODAY     = getToday();
const YESTERDAY = getYesterday();

// 이번 달 첫째 날 YYYY-MM-01
function getFirstDayOfMonth(): string {
  return `${TODAY.slice(0, 7)}-01`;
}

// ─── 모의 데이터 ───────────────────────────────────────────────

// 오늘: 수입(급여 ¥250,000) + 지출(기타 ¥1,500)
// 어제: 지출(식비 ¥5,000)
const MOCK_TRANSACTIONS_MIXED: object[] = [
  {
    id: 'tx-income-1',
    type: 'income',
    amount: 250000,
    category: '급여',
    date: TODAY,
    createdAt: { _seconds: 1750254000, _nanoseconds: 0 },
  },
  {
    id: 'tx-expense-1',
    type: 'expense',
    amount: 1500,
    category: '기타',
    date: TODAY,
    memo: '주유비 결제',
    createdAt: { _seconds: 1750250000, _nanoseconds: 0 },
  },
  {
    id: 'tx-expense-2',
    type: 'expense',
    amount: 5000,
    category: '식비',
    date: YESTERDAY,
    memo: '점심 식사',
    createdAt: { _seconds: 1750160000, _nanoseconds: 0 },
  },
];

// 거래가 없는 달 시나리오
const MOCK_TRANSACTIONS_EMPTY: object[] = [];

// ─── 공통 헬퍼 ────────────────────────────────────────────────

// PIN 인증을 모킹하고 메인 앱으로 이동
async function goToMainApp(page: Page): Promise<void> {
  await page.route('**/settings/pin/verify', route =>
    route.fulfill({ json: { success: true } })
  );
  await page.goto('/');
  for (const num of ['1', '2', '3', '4']) {
    await page.getByRole('button', { name: num, exact: true }).click();
  }
  await expect(page.getByRole('navigation')).toBeVisible();
}

// 거래 내역 API 모킹 (GET /transactions* → 지정 데이터, POST는 통과)
async function mockTransactions(page: Page, data: object[]): Promise<void> {
  await page.route('**/transactions*', route => {
    if (route.request().method() === 'GET') {
      route.fulfill({ json: data });
    } else {
      route.continue();
    }
  });
}

// 달력 탭으로 이동 후 그리드 로딩 대기
// 오늘 날짜의 data-date 셀이 보이면 렌더링 완료로 판정
async function goToCalendarTab(page: Page): Promise<void> {
  await page.getByRole('button', { name: '달력' }).click();
  await expect(page.locator(`[data-date="${TODAY}"]`)).toBeVisible({ timeout: 8000 });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. 달력 그리드 — 기본 렌더링
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
test.describe('달력 그리드 — 기본 렌더링', () => {
  test.beforeEach(async ({ page }) => {
    await mockTransactions(page, MOCK_TRANSACTIONS_MIXED);
    await goToMainApp(page);
    await goToCalendarTab(page);
  });

  test('7개의 요일 헤더(일~토)가 표시된다', async ({ page }) => {
    for (const label of ['일', '월', '화', '수', '목', '금', '토']) {
      await expect(page.getByText(label).first()).toBeVisible();
    }
  });

  test('오늘 날짜 셀(data-date)이 달력에 표시된다', async ({ page }) => {
    await expect(page.locator(`[data-date="${TODAY}"]`)).toBeVisible();
  });

  test('이번 달 1일 셀이 달력에 표시된다', async ({ page }) => {
    await expect(page.locator(`[data-date="${getFirstDayOfMonth()}"]`)).toBeVisible();
  });

  test('달력 탭 활성 시 하단 탭바에 달력이 선택 표시된다', async ({ page }) => {
    await expect(page.getByRole('navigation')).toContainText('달력');
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2. 달력 그리드 — 금액 표시
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
test.describe('달력 그리드 — 금액 표시', () => {
  test.beforeEach(async ({ page }) => {
    await mockTransactions(page, MOCK_TRANSACTIONS_MIXED);
    await goToMainApp(page);
    await goToCalendarTab(page);
  });

  test('오늘 날짜 셀에 수입 단축 금액이 표시된다', async ({ page }) => {
    // 수입 ¥250,000 → "25万"
    const incomeLabel = formatYenShort(250000);
    await expect(page.getByText(incomeLabel).first()).toBeVisible();
  });

  test('오늘 날짜 셀에 지출 단축 금액이 표시된다', async ({ page }) => {
    // 지출 ¥1,500 → "-1.5千"
    const expenseLabel = `-${formatYenShort(1500)}`;
    await expect(page.getByText(expenseLabel).first()).toBeVisible();
  });

  test('어제 날짜 셀에 지출 단축 금액이 표시된다', async ({ page }) => {
    // 어제 지출 ¥5,000 → "-5千"
    // 오늘과 어제가 같은 달인 경우에만 표시됨
    if (TODAY.slice(0, 7) !== YESTERDAY.slice(0, 7)) {
      test.skip();
      return;
    }
    const expenseLabel = `-${formatYenShort(5000)}`;
    await expect(page.getByText(expenseLabel).first()).toBeVisible();
  });

  test('거래 없는 달에서는 금액 레이블이 표시되지 않는다', async ({ page }) => {
    // 이전 달로 이동 (이전 달 거래는 빈 배열로 모킹됨)
    await page.route('**/transactions*', route => {
      if (route.request().method() === 'GET') {
        route.fulfill({ json: [] });
      } else {
        route.continue();
      }
    });
    await page.getByRole('button', { name: '이전 달' }).click();
    await expect(page.getByText(getPrevMonthLabel())).toBeVisible({ timeout: 5000 });

    // 금액 관련 텍스트가 없어야 함
    await expect(page.getByText('万').first()).not.toBeVisible();
    await expect(page.getByText('千').first()).not.toBeVisible();
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3. 날짜 클릭 — 바텀시트 열기
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
test.describe('날짜 클릭 — 바텀시트', () => {
  test.beforeEach(async ({ page }) => {
    await mockTransactions(page, MOCK_TRANSACTIONS_MIXED);
    await goToMainApp(page);
    await goToCalendarTab(page);
  });

  test('오늘 날짜 클릭 시 바텀시트가 열린다', async ({ page }) => {
    await page.locator(`[data-date="${TODAY}"]`).click();

    // 바텀시트 헤더 날짜 레이블 확인
    const headerText = formatDateHeader(TODAY);
    await expect(page.getByText(headerText)).toBeVisible({ timeout: 3000 });
  });

  test('바텀시트에 해당 날짜 거래 카테고리가 표시된다', async ({ page }) => {
    await page.locator(`[data-date="${TODAY}"]`).click();

    // 오늘 거래: 급여(수입), 기타(지출)
    await expect(page.getByText('급여').first()).toBeVisible();
    await expect(page.getByText('기타').first()).toBeVisible();
  });

  test('바텀시트에 해당 날짜 거래 금액이 표시된다', async ({ page }) => {
    await page.locator(`[data-date="${TODAY}"]`).click();

    // 오늘 거래 금액 (전체 금액 표시)
    await expect(page.getByText('+¥250,000').first()).toBeVisible();
    await expect(page.getByText('-¥1,500').first()).toBeVisible();
  });

  test('바텀시트에 메모가 있는 거래의 메모가 표시된다', async ({ page }) => {
    await page.locator(`[data-date="${TODAY}"]`).click();

    // 기타 거래 메모 "주유비 결제"
    await expect(page.getByText('주유비 결제')).toBeVisible();
  });

  test('어제 날짜 클릭 시 해당 날짜 거래가 바텀시트에 표시된다', async ({ page }) => {
    // 오늘과 어제가 다른 달이면 테스트 스킵
    if (TODAY.slice(0, 7) !== YESTERDAY.slice(0, 7)) {
      test.skip();
      return;
    }

    await page.locator(`[data-date="${YESTERDAY}"]`).click();

    const headerText = formatDateHeader(YESTERDAY);
    await expect(page.getByText(headerText)).toBeVisible();
    await expect(page.getByText('식비').first()).toBeVisible();
    await expect(page.getByText('-¥5,000').first()).toBeVisible();
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 4. 날짜 클릭 — 바텀시트 닫기
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
test.describe('날짜 클릭 — 바텀시트 닫기', () => {
  test.beforeEach(async ({ page }) => {
    await mockTransactions(page, MOCK_TRANSACTIONS_MIXED);
    await goToMainApp(page);
    await goToCalendarTab(page);
  });

  test('✕ 버튼 클릭 시 바텀시트가 닫힌다', async ({ page }) => {
    await page.locator(`[data-date="${TODAY}"]`).click();

    const headerText = formatDateHeader(TODAY);
    await expect(page.getByText(headerText)).toBeVisible();

    // aria-label="닫기" 버튼으로 닫기
    await page.getByRole('button', { name: '닫기' }).click();
    await expect(page.getByText(headerText)).not.toBeVisible();
  });

  test('오버레이 클릭 시 바텀시트가 닫힌다', async ({ page }) => {
    await page.locator(`[data-date="${TODAY}"]`).click();

    const headerText = formatDateHeader(TODAY);
    await expect(page.getByText(headerText)).toBeVisible();

    // 화면 상단 달력 영역(y=150)을 클릭 → 오버레이 클릭으로 닫힘
    await page.mouse.click(200, 150);
    await expect(page.getByText(headerText)).not.toBeVisible();
  });

  test('바텀시트가 열린 상태에서는 ✕ 버튼 또는 오버레이로만 닫힌다', async ({ page }) => {
    // 바텀시트가 열리면 fixed inset-0 오버레이가 화면 전체를 덮기 때문에
    // 날짜 셀 재클릭은 불가 → ✕ 버튼 또는 오버레이 클릭으로만 닫을 수 있음
    await page.locator(`[data-date="${TODAY}"]`).click();

    const headerText = formatDateHeader(TODAY);
    await expect(page.getByText(headerText)).toBeVisible();

    // 오버레이 영역(화면 상단)을 클릭해서 닫기
    await page.mouse.click(200, 100);
    await expect(page.getByText(headerText)).not.toBeVisible();
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 5. 날짜 클릭 — 빈 상태
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
test.describe('날짜 클릭 — 빈 상태', () => {
  test('거래 없는 날짜 클릭 시 "이날의 거래 내역이 없습니다" 메시지가 표시된다', async ({ page }) => {
    await mockTransactions(page, MOCK_TRANSACTIONS_MIXED);
    await goToMainApp(page);
    await goToCalendarTab(page);

    // 거래 없는 날짜: 오늘/어제가 아닌 이번 달 1일을 사용
    // 단, 오늘이나 어제가 1일이면 2일을 사용
    const todayDay  = Number(TODAY.slice(8));
    const yesterDay = Number(YESTERDAY.slice(8));
    const emptyDay  = String(todayDay !== 1 && yesterDay !== 1 ? 1 : 2).padStart(2, '0');
    const emptyDate = `${TODAY.slice(0, 7)}-${emptyDay}`;

    await page.locator(`[data-date="${emptyDate}"]`).click();
    await expect(page.getByText('이날의 거래 내역이 없습니다')).toBeVisible({ timeout: 3000 });
  });

  test('거래 없는 달 이동 시 달력에 금액 레이블이 없다', async ({ page }) => {
    await mockTransactions(page, MOCK_TRANSACTIONS_EMPTY);
    await goToMainApp(page);
    await goToCalendarTab(page);

    // 금액 관련 텍스트가 없어야 함
    await expect(page.getByText('万').first()).not.toBeVisible();
    await expect(page.getByText('千').first()).not.toBeVisible();
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 6. 연월 변경
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
test.describe('연월 변경', () => {
  test.beforeEach(async ({ page }) => {
    await mockTransactions(page, MOCK_TRANSACTIONS_MIXED);
    await goToMainApp(page);
    await goToCalendarTab(page);
  });

  test('"이전 달" 버튼 클릭 시 이전 달 달력이 표시된다', async ({ page }) => {
    await page.getByRole('button', { name: '이전 달' }).click();
    await expect(page.getByText(getPrevMonthLabel())).toBeVisible({ timeout: 5000 });
  });

  test('이전 달로 이동 후 "다음 달" 버튼 클릭 시 현재 달로 돌아온다', async ({ page }) => {
    const [y, m] = TODAY.split('-').map(Number);
    const currentLabel = `${y}년 ${m}월`;

    await page.getByRole('button', { name: '이전 달' }).click();
    await expect(page.getByText(getPrevMonthLabel())).toBeVisible();

    await page.getByRole('button', { name: '다음 달' }).click();
    await expect(page.getByText(currentLabel)).toBeVisible({ timeout: 5000 });
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 7. refreshKey 갱신 — 거래 저장 후 달력 반영
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
test.describe('refreshKey 갱신', () => {
  test('거래 저장 후 달력에 새 거래 금액이 반영된다', async ({ page }) => {
    // 저장 전: 거래 없음
    let txStore: object[] = [];

    await page.route('**/transactions*', route => {
      if (route.request().method() === 'GET') {
        route.fulfill({ json: txStore });
      } else if (route.request().method() === 'POST') {
        // 저장 요청이 오면 txStore에 새 거래 추가
        const newTx = {
          id: 'tx-new-1',
          type: 'expense',
          amount: 3000,
          category: '식비',
          date: TODAY,
          createdAt: { _seconds: Math.floor(Date.now() / 1000), _nanoseconds: 0 },
        };
        txStore = [newTx];
        route.fulfill({ json: newTx });
      } else {
        route.continue();
      }
    });
    await page.route('**/budgets/**', route =>
      route.fulfill({ status: 404, json: { error: 'Not found' } })
    );

    await goToMainApp(page);
    await goToCalendarTab(page);

    // 저장 전: 금액 레이블 없음
    await expect(page.getByText('万').first()).not.toBeVisible();
    await expect(page.getByText('千').first()).not.toBeVisible();

    // FAB(+) 클릭 → 거래 입력 폼 열기
    await page.getByRole('button', { name: '거래 추가' }).click();
    await expect(page.getByText('지출')).toBeVisible({ timeout: 5000 });

    // 금액 입력
    await page.getByPlaceholder('0').fill('3000');

    // 카테고리 선택
    await page.getByRole('button', { name: '식비', exact: true }).first().click();

    // 저장
    await page.getByRole('button', { name: '저장' }).click();

    // 저장 후 달력에 -3千 이 표시되어야 함
    await expect(
      page.getByText(`-${formatYenShort(3000)}`).first()
    ).toBeVisible({ timeout: 8000 });
  });
});
