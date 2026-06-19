import { test, expect, Page } from '@playwright/test';

// HomeTab E2E 테스트 — Phase 10: 홈 화면
//
// 관련 컴포넌트:
//   - HomeTab.tsx  : 예산 대시보드 + 날짜별 거래 내역 그룹 표시
//   - MainApp.tsx  : refreshKey 트리거 (거래 저장 완료 시 +1)
//   - api.ts       : getTransactions, getBudget
//
// 모킹 전략:
//   page.route()로 백엔드 API를 모킹 — 일관된 테스트 데이터 사용
//   - PIN 인증   : POST /settings/pin/verify → { success: true }
//   - 거래 내역  : GET  /transactions*       → MOCK_TRANSACTIONS
//   - 예산       : GET  /budgets/**          → MOCK_BUDGET 또는 404

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

// 현재 연월 YYYY-MM
function getCurrentYM(): string {
  return getToday().slice(0, 7);
}

// 이전 연월 YYYY-MM
function getPrevYM(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0')].join('-');
}

// 이전 달 레이블 "YYYY년 M월"
function getPrevMonthLabel(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
}

// HomeTab.tsx의 formatDateHeader 와 동일한 로직
// "2026-06-18" → "6월 18일 (목)"
function formatDateHeader(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${m}월 ${d}일 (${days[date.getDay()]})`;
}

const TODAY     = getToday();
const YESTERDAY = getYesterday();

// ─── 모의 데이터 ───────────────────────────────────────────────

// 오늘: 수입(급여 ¥250,000) + 지출(기타 ¥1,500)
// 어제: 지출(식비 ¥5,000)
const MOCK_TRANSACTIONS_MIXED: object[] = [
  {
    id: 'tx-income-1',
    type: 'income',
    amount: 250000,
    category: '급여',
    description: '6월 급여',
    date: TODAY,
    createdAt: { _seconds: 1750254000, _nanoseconds: 0 },
  },
  {
    id: 'tx-expense-1',
    type: 'expense',
    amount: 1500,
    category: '기타',
    description: '주유비',
    date: TODAY,
    memo: '주유비 결제',
    createdAt: { _seconds: 1750250000, _nanoseconds: 0 },
  },
  {
    id: 'tx-expense-2',
    type: 'expense',
    amount: 5000,
    category: '식비',
    description: '점심',
    date: YESTERDAY,
    memo: '점심 식사',
    createdAt: { _seconds: 1750160000, _nanoseconds: 0 },
  },
];

// 예산 90% 초과 시나리오: 지출 ¥6,500 (예산 ¥7,000 → 92.8%)
const MOCK_TRANSACTIONS_HIGH_EXPENSE: object[] = [
  {
    id: 'tx-high-1',
    type: 'expense',
    amount: 6500,
    category: '식비',
    description: '큰 지출',
    date: TODAY,
    createdAt: { _seconds: 1750254000, _nanoseconds: 0 },
  },
];

// 예산 ¥300,000 (정상 범위)
const MOCK_BUDGET_NORMAL = {
  id: 'budget-normal',
  yearMonth: getCurrentYM(),
  amount: 300000,
};

// 예산 ¥7,000 (tight — 92% 소진 시 빨간 경고)
const MOCK_BUDGET_TIGHT = {
  id: 'budget-tight',
  yearMonth: getCurrentYM(),
  amount: 7000,
};

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

// 예산 API 모킹 (null = 404 미설정)
async function mockBudget(page: Page, budget: object | null): Promise<void> {
  await page.route('**/budgets/**', route => {
    if (budget === null) {
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Not found' }),
      });
    } else {
      route.fulfill({ json: budget });
    }
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. 예산 대시보드 — 미설정 상태
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
test.describe('예산 대시보드 — 예산 미설정', () => {
  test.beforeEach(async ({ page }) => {
    await mockTransactions(page, MOCK_TRANSACTIONS_MIXED);
    await mockBudget(page, null);
    await goToMainApp(page);
  });

  test('예산 컬럼에 "미설정" 텍스트가 표시된다', async ({ page }) => {
    await expect(page.getByText('미설정')).toBeVisible();
  });

  test('세 번째 컬럼 레이블이 "잔여" 대신 "수입"으로 표시된다', async ({ page }) => {
    // 예산 미설정이면 잔여 예산 대신 수입 총액을 표시
    await expect(page.getByText('수입').first()).toBeVisible();
    await expect(page.getByText('잔여')).not.toBeVisible();
  });

  test('수입 총액 ¥250,000이 표시된다', async ({ page }) => {
    await expect(page.getByText('¥250,000').first()).toBeVisible();
  });

  test('"이번 달 수입" 안내 텍스트와 금액이 표시된다', async ({ page }) => {
    await expect(page.getByText(/이번 달 수입/)).toBeVisible();
  });

  test('지출 총액 ¥1,500이 표시된다', async ({ page }) => {
    // 대시보드 지출 컬럼
    await expect(page.getByText('¥1,500').first()).toBeVisible();
  });

  test('예산 미설정이면 진행 바가 표시되지 않는다', async ({ page }) => {
    await expect(page.getByText(/소진/)).not.toBeVisible();
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2. 예산 대시보드 — 예산 설정 상태
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
test.describe('예산 대시보드 — 예산 설정', () => {
  test.beforeEach(async ({ page }) => {
    // 지출 ¥1,500, 예산 ¥300,000 → 잔여 ¥298,500
    await mockTransactions(page, MOCK_TRANSACTIONS_MIXED);
    await mockBudget(page, MOCK_BUDGET_NORMAL);
    await goToMainApp(page);
  });

  test('예산 금액 ¥300,000이 표시된다', async ({ page }) => {
    await expect(page.getByText('¥300,000')).toBeVisible();
  });

  test('세 번째 컬럼 레이블이 "잔여"로 표시된다', async ({ page }) => {
    await expect(page.getByText('잔여')).toBeVisible();
    await expect(page.getByText('수입').first()).toBeVisible(); // "이번 달 수입" 텍스트에도 있으므로 잔여 확인이 중요
  });

  test('잔여 예산이 올바르게 계산된다 (300,000 - 6,500 = 293,500)', async ({ page }) => {
    // MOCK_TRANSACTIONS_MIXED: 지출 ¥1,500 + ¥5,000 = ¥6,500
    await expect(page.getByText('¥293,500')).toBeVisible();
  });

  test('예산 소진 진행 바가 표시된다', async ({ page }) => {
    // 소진 퍼센트 텍스트 확인 (1,500 / 300,000 = 0.5%)
    await expect(page.getByText(/소진/)).toBeVisible();
  });

  test('예산 소진율 텍스트에 % 기호가 포함된다', async ({ page }) => {
    const text = await page.getByText(/소진/).textContent();
    expect(text).toMatch(/\d+%/);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3. 예산 90% 이상 소진 — 경고 상태
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
test.describe('예산 대시보드 — 90% 이상 소진 경고', () => {
  test.beforeEach(async ({ page }) => {
    // 지출 ¥6,500 / 예산 ¥7,000 = 92.8% 소진
    await mockTransactions(page, MOCK_TRANSACTIONS_HIGH_EXPENSE);
    await mockBudget(page, MOCK_BUDGET_TIGHT);
    await goToMainApp(page);
  });

  test('소진율이 90% 이상으로 표시된다', async ({ page }) => {
    await expect(page.getByText(/소진/)).toBeVisible();
    const text = await page.getByText(/소진/).textContent() ?? '';
    const match = text.match(/(\d+)%/);
    expect(match).not.toBeNull();
    expect(parseInt(match![1], 10)).toBeGreaterThanOrEqual(90);
  });

  test('잔여 예산이 올바르게 계산된다 (7,000 - 6,500 = 500)', async ({ page }) => {
    await expect(page.getByText('¥500')).toBeVisible();
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 4. 날짜별 거래 내역
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
test.describe('날짜별 거래 내역', () => {
  test.beforeEach(async ({ page }) => {
    await mockTransactions(page, MOCK_TRANSACTIONS_MIXED);
    await mockBudget(page, null);
    await goToMainApp(page);
  });

  test('오늘 날짜 헤더가 "M월 D일 (요일)" 형식으로 표시된다', async ({ page }) => {
    const expected = formatDateHeader(TODAY);
    await expect(page.getByText(expected)).toBeVisible();
  });

  test('어제 날짜 헤더가 "M월 D일 (요일)" 형식으로 표시된다', async ({ page }) => {
    const expected = formatDateHeader(YESTERDAY);
    await expect(page.getByText(expected)).toBeVisible();
  });

  test('오늘 날짜 헤더에 수입 소계가 표시된다 (+¥250,000)', async ({ page }) => {
    // 같은 금액이 날짜 헤더 소계 + 거래 항목 행 두 곳에 렌더링됨 → first() 사용
    await expect(page.getByText('+¥250,000').first()).toBeVisible();
  });

  test('오늘 날짜 헤더에 지출 소계가 표시된다 (-¥1,500)', async ({ page }) => {
    // 날짜 헤더 소계와 거래 항목 행에 중복 → first() 사용
    await expect(page.getByText('-¥1,500').first()).toBeVisible();
  });

  test('카테고리 칩이 표시된다 (급여, 기타, 식비)', async ({ page }) => {
    await expect(page.getByText('급여').first()).toBeVisible();
    await expect(page.getByText('기타').first()).toBeVisible();
    await expect(page.getByText('식비').first()).toBeVisible();
  });

  test('수입 금액에 + 부호와 ¥ 기호가 표시된다 (+¥250,000)', async ({ page }) => {
    // 날짜 헤더 소계와 거래 행 두 곳에 존재 → first() 사용
    await expect(page.getByText('+¥250,000').first()).toBeVisible();
  });

  test('지출 금액에 - 부호와 ¥ 기호가 표시된다 (-¥5,000)', async ({ page }) => {
    // 날짜 헤더 소계(어제 -¥5,000)와 거래 행 두 곳에 존재 → first() 사용
    await expect(page.getByText('-¥5,000').first()).toBeVisible();
  });

  test('날짜가 최신순(내림차순)으로 정렬된다 — 오늘이 어제보다 위에 표시', async ({ page }) => {
    const todayHeader     = formatDateHeader(TODAY);
    const yesterdayHeader = formatDateHeader(YESTERDAY);

    const todayY     = (await page.getByText(todayHeader).boundingBox())?.y     ?? 0;
    const yesterdayY = (await page.getByText(yesterdayHeader).boundingBox())?.y ?? 0;

    expect(todayY).toBeLessThan(yesterdayY);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 5. 빈 달 — 거래 내역 없음
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
test.describe('빈 달 — 거래 내역 없음', () => {
  test.beforeEach(async ({ page }) => {
    await mockTransactions(page, []); // 빈 배열
    await mockBudget(page, null);
    await goToMainApp(page);
  });

  test('"이번 달 거래 내역이 없습니다." 안내 문구가 표시된다', async ({ page }) => {
    await expect(page.getByText('이번 달 거래 내역이 없습니다.')).toBeVisible();
  });

  test('"+ 버튼을 눌러 첫 번째 내역을 추가해 보세요." 안내가 표시된다', async ({ page }) => {
    await expect(page.getByText(/\+ 버튼을 눌러/)).toBeVisible();
  });

  test('날짜 헤더와 거래 항목이 표시되지 않는다', async ({ page }) => {
    const todayHeader = formatDateHeader(TODAY);
    await expect(page.getByText(todayHeader)).not.toBeVisible();
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 6. 연월 변경 시 데이터 갱신
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
test.describe('연월 변경 시 데이터 갱신', () => {
  test('이전 달로 이동하면 해당 월의 API가 호출되고 화면이 갱신된다', async ({ page }) => {
    const prevYM    = getPrevYM();
    const prevLabel = getPrevMonthLabel();

    // 이전 달 요청 여부 추적
    let prevMonthApiCalled = false;
    await page.route('**/transactions*', route => {
      const url = route.request().url();
      if (url.includes(prevYM)) {
        prevMonthApiCalled = true;
        route.fulfill({ json: [] }); // 이전 달은 거래 없음
      } else {
        route.fulfill({ json: MOCK_TRANSACTIONS_MIXED }); // 이번 달은 데이터 있음
      }
    });
    await mockBudget(page, null);
    await goToMainApp(page);

    // 이번 달 데이터 먼저 표시됨 확인
    await expect(page.getByText('급여').first()).toBeVisible();

    // 이전 달 버튼 클릭
    await page.getByRole('button', { name: '이전 달' }).click();

    // MonthSelector 레이블 갱신 확인
    await expect(page.getByText(prevLabel)).toBeVisible();

    // 이전 달 API가 실제로 호출됐는지 확인
    expect(prevMonthApiCalled).toBe(true);

    // 이전 달은 거래 없음 → 빈 상태 안내 표시
    await expect(page.getByText('이번 달 거래 내역이 없습니다.')).toBeVisible();
  });

  test('다음 달로 이동 후 다시 이번 달로 돌아오면 이번 달 데이터가 복원된다', async ({ page }) => {
    await mockTransactions(page, MOCK_TRANSACTIONS_MIXED);
    await mockBudget(page, null);
    await goToMainApp(page);

    // 이번 달 데이터 확인
    await expect(page.getByText('급여').first()).toBeVisible();

    // 다음 달로 이동
    await page.getByRole('button', { name: '다음 달' }).click();
    // 다시 이번 달로 복귀
    await page.getByRole('button', { name: '이전 달' }).click();

    // 이번 달 데이터 복원 확인
    await expect(page.getByText('급여').first()).toBeVisible();
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 7. 거래 저장 후 refreshKey 트리거 — 목록 자동 갱신
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
test.describe('거래 저장 후 목록 자동 갱신 (refreshKey)', () => {
  test('저장 후 홈 탭에 새 거래 항목이 즉시 표시된다', async ({ page }) => {
    // GET 응답을 동적으로 변경하는 클로저 패턴
    // POST 완료 후 GET을 재호출할 때 새 항목이 포함된 배열 반환
    let txStore: object[] = [];

    await page.route('**/transactions*', async route => {
      const method = route.request().method();
      if (method === 'POST') {
        // 저장 요청 처리: 응답 생성 후 스토어에 추가
        const body = JSON.parse(route.request().postData() || '{}') as Record<string, unknown>;
        const newTx = {
          id: 'new-tx-auto',
          ...body,
          createdAt: { _seconds: 1750300000, _nanoseconds: 0 },
        };
        txStore = [newTx];
        await route.fulfill({ json: newTx });
      } else {
        // 조회 요청: 현재 스토어 반환 (refreshKey 갱신 시 재호출됨)
        await route.fulfill({ json: txStore });
      }
    });
    await mockBudget(page, null);
    await goToMainApp(page);

    // 초기 빈 상태 확인
    await expect(page.getByText('이번 달 거래 내역이 없습니다.')).toBeVisible();

    // FAB + 버튼으로 거래 추가 폼 열기
    await page.getByRole('button', { name: '거래 추가' }).click();
    await expect(page.getByRole('heading', { name: '내역 추가' })).toBeVisible();

    // 지출 모드에서 카테고리(식비) 선택
    await page.getByRole('button', { name: '식비', exact: true }).click();

    // 금액 입력
    await page.getByPlaceholder('0').fill('3000');

    // 저장
    await page.getByRole('button', { name: '저장' }).click();

    // 폼이 닫히고
    await expect(page.getByRole('heading', { name: '내역 추가' })).not.toBeVisible({ timeout: 5000 });

    // 홈 탭에 새 항목이 자동으로 표시됨 (refreshKey 트리거)
    // 날짜 헤더 소계와 거래 행 두 곳에 -¥3,000이 존재 → first() 사용
    await expect(page.getByText('식비').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('-¥3,000').first()).toBeVisible({ timeout: 5000 });
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 6. 날짜 헤더 — 순수익 표시 (Phase 14.3)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
test.describe('날짜 헤더 — 순수익 표시', () => {
  // MOCK_TRANSACTIONS_MIXED: 오늘 수입 ¥250,000 + 지출 ¥1,500 → 순수익 ¥248,500
  test.beforeEach(async ({ page }) => {
    await mockTransactions(page, MOCK_TRANSACTIONS_MIXED);
    await mockBudget(page, null);
    await goToMainApp(page);
  });

  test('수입·지출 모두 있는 날 헤더에 =¥248,500 순수익이 표시된다', async ({ page }) => {
    await expect(page.getByText('=¥248,500')).toBeVisible();
  });

  test('지출만 있는 날(어제) 헤더에는 순수익이 표시되지 않는다', async ({ page }) => {
    // 어제: 지출 ¥5,000만 있으므로 "=" 기호가 어제 헤더 근처에 없어야 함
    // 오늘의 "=¥248,500"은 있지만 어제 헤더 영역의 "=" 는 없어야 함
    const yesterdayHeader = page.getByText(formatDateHeader(YESTERDAY));
    await expect(yesterdayHeader).toBeVisible();
    // 어제 날짜 헤더의 부모 그룹 안에 "=" 로 시작하는 순수익 요소가 없음을 확인
    // → 페이지 전체에 "=¥" 가 포함된 텍스트가 정확히 1개만 있어야 함 (오늘 것만)
    await expect(page.locator('text=/=¥/')).toHaveCount(1);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 7. 거래 항목 클릭 — 상세 시트 / 수정 / 삭제 (Phase 14.3)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
test.describe('거래 항목 클릭 — 상세 시트', () => {
  test.beforeEach(async ({ page }) => {
    await mockTransactions(page, MOCK_TRANSACTIONS_MIXED);
    await mockBudget(page, MOCK_BUDGET_NORMAL);
    await goToMainApp(page);
  });

  test('거래 항목 클릭 시 상세 시트가 열린다', async ({ page }) => {
    // "주유비 결제" 메모를 클릭하면 상세 시트 헤더가 보여야 함
    await page.getByText('주유비 결제').click();
    await expect(page.getByText('거래 상세')).toBeVisible();
  });

  test('상세 시트에 유형·카테고리·금액·메모가 올바르게 표시된다', async ({ page }) => {
    await page.getByText('주유비 결제').click();
    await expect(page.getByText('거래 상세')).toBeVisible();
    // 유형
    await expect(page.getByText('지출').first()).toBeVisible();
    // 카테고리 (detail card 안에 표시되는 것)
    // 금액 — detail card 안: "-¥1,500" (거래 행의 -¥1,500과 별개로 한 번 더 표시)
    await expect(page.getByText('-¥1,500').first()).toBeVisible();
    // 메모
    await expect(page.getByText('주유비 결제').first()).toBeVisible();
  });

  test('✕ 버튼 클릭 시 상세 시트가 닫힌다', async ({ page }) => {
    await page.getByText('주유비 결제').click();
    await expect(page.getByText('거래 상세')).toBeVisible();

    await page.getByRole('button', { name: '✕' }).click();
    await expect(page.getByText('거래 상세')).not.toBeVisible();
  });

  test('오버레이 클릭 시 상세 시트가 닫힌다', async ({ page }) => {
    await page.getByText('주유비 결제').click();
    await expect(page.getByText('거래 상세')).toBeVisible();

    // 오버레이 영역(시트 바깥 빈 공간)을 클릭 — 화면 좌상단은 시트 밖
    await page.mouse.click(10, 10);
    await expect(page.getByText('거래 상세')).not.toBeVisible();
  });

  test('[수정] 클릭 시 수정 폼이 열리고 기존 금액이 채워진다', async ({ page }) => {
    await page.getByText('주유비 결제').click();
    await page.getByRole('button', { name: '수정' }).click();

    // 상세 시트가 닫히고 수정 폼이 열림
    await expect(page.getByRole('heading', { name: '내역 수정' })).toBeVisible();
    // 기존 금액 1500이 입력란에 채워져 있음
    await expect(page.getByPlaceholder('0')).toHaveValue('1500');
  });

  test('[삭제] 클릭 시 삭제 확인 화면으로 전환된다', async ({ page }) => {
    await page.getByText('주유비 결제').click();
    await expect(page.getByText('거래 상세')).toBeVisible();

    await page.getByRole('button', { name: '삭제' }).click();

    await expect(page.getByText('거래를 삭제하시겠습니까?')).toBeVisible();
    await expect(page.getByRole('button', { name: '취소' })).toBeVisible();
  });

  test('삭제 확인 → [취소] 클릭 시 상세 보기 화면으로 복귀한다', async ({ page }) => {
    await page.getByText('주유비 결제').click();
    await page.getByRole('button', { name: '삭제' }).click();
    await expect(page.getByText('거래를 삭제하시겠습니까?')).toBeVisible();

    await page.getByRole('button', { name: '취소' }).click();

    // 상세 보기로 복귀 (수정·삭제 버튼이 다시 보임)
    await expect(page.getByText('거래 상세')).toBeVisible();
    await expect(page.getByRole('button', { name: '수정' })).toBeVisible();
  });

  test('삭제 확인 → [삭제] 클릭 후 상세 시트가 닫힌다', async ({ page }) => {
    // DELETE 요청을 모킹 — route.fallback()으로 GET 요청은 기존 mockTransactions에 위임
    await page.route('**/transactions/**', route => {
      if (route.request().method() === 'DELETE') {
        return route.fulfill({ status: 204 });
      }
      route.fallback();
    });

    await page.getByText('주유비 결제').click();
    await page.getByRole('button', { name: '삭제' }).click();
    await expect(page.getByText('거래를 삭제하시겠습니까?')).toBeVisible();

    // 삭제 확인 버튼 (exact: true — "삭제" 정확히 매칭, "거래를 삭제하시겠습니까?" 미포함)
    await page.getByRole('button', { name: '삭제', exact: true }).click();

    // 삭제 성공 → closeDetail() 호출 → 시트 닫힘
    await expect(page.getByText('거래 상세')).not.toBeVisible({ timeout: 5000 });
  });
});
