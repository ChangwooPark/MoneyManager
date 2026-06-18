import { test, expect, Page } from '@playwright/test';

// 메인 앱 화면 (PIN 인증 후) E2E 테스트
//
// 구현 참고:
//   - MainApp.tsx : 탭(activeTab), 연월(yearMonth), 폼(showForm) 상태 관리
//   - BottomNav.tsx: 활성 탭 style.color = 'var(--accent)', 비활성 = 'var(--text-secondary)'
//   - MonthSelector.tsx: aria-label="이전 달" / "다음 달", 표시 형식 "YYYY년 M월"
//   - TransactionForm.tsx: 토글 style.backgroundColor, 유효성 오류 메시지
//   - API: POST /settings/pin/verify, POST /transactions

// ─── 헬퍼: 오늘 날짜를 YYYY-MM-DD 형식으로 반환 ─────────────────
function getTodayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ─── 헬퍼: 현재 연월을 "YYYY년 M월" 형식으로 반환 ───────────────
function getCurrentMonthLabel(): string {
  const now = new Date();
  return `${now.getFullYear()}년 ${now.getMonth() + 1}월`;
}

// ─── 헬퍼: 이전 달 레이블 반환 ──────────────────────────────────
function getPrevMonthLabel(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
}

// ─── 헬퍼: 다음 달 레이블 반환 ──────────────────────────────────
function getNextMonthLabel(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
}

// ─── 헬퍼: PIN 인증을 모킹하고 메인 앱으로 이동 ─────────────────
// 모든 테스트는 PIN 인증이 완료된 메인 앱 화면에서 시작해야 하므로
// page.route()로 verifyPin API를 성공 응답으로 모킹한 뒤 PIN을 입력합니다.
async function goToMainApp(page: Page): Promise<void> {
  await page.route('**/settings/pin/verify', route =>
    route.fulfill({ json: { success: true } })
  );
  await page.goto('/');
  // PIN 4자리 입력 (임의 숫자 — 모킹이므로 값 무관)
  for (const num of ['1', '2', '3', '4']) {
    await page.getByRole('button', { name: num, exact: true }).click();
  }
  // 메인 앱이 뜰 때까지 대기
  await expect(page.getByRole('navigation')).toBeVisible();
}

// ─── 헬퍼: 내역 추가 모달 열기 ──────────────────────────────────
async function openTransactionForm(page: Page): Promise<void> {
  await page.getByRole('button', { name: '거래 추가' }).click();
  await expect(page.getByRole('heading', { name: '내역 추가' })).toBeVisible();
}

test.describe('메인 앱 화면', () => {
  test.beforeEach(async ({ page }) => {
    await goToMainApp(page);
  });

  // ─── 1. 전체 레이아웃 ────────────────────────────────────────

  test('PIN 인증 성공 직후 PIN 화면이 사라지고 메인 앱이 나타난다', async ({ page }) => {
    // PIN 화면 요소(숫자 패드)가 사라져야 함
    await expect(page.getByText('PIN 번호를 입력하세요')).not.toBeVisible();
    // 메인 앱의 핵심 요소들이 표시되어야 함
    await expect(page.getByRole('navigation')).toBeVisible();
    await expect(page.getByRole('button', { name: '거래 추가' })).toBeVisible();
  });

  test('화면이 월 선택기 / 콘텐츠 / 하단 내비게이션 3구역으로 구성된다', async ({ page }) => {
    await expect(page.getByRole('button', { name: '이전 달' })).toBeVisible();
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('navigation')).toBeVisible();
  });

  // ─── 2. 하단 내비게이션 바 ───────────────────────────────────

  test('홈 / 달력 / 통계 / 더보기 탭 버튼 4개가 모두 렌더링된다', async ({ page }) => {
    await expect(page.getByRole('button', { name: /홈/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /달력/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /통계/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /더보기/ })).toBeVisible();
  });

  test('초기 진입 시 홈 탭이 accent 색상(활성)으로 표시된다', async ({ page }) => {
    const nav = page.getByRole('navigation');
    const tabColors = await nav.locator('button').evaluateAll(buttons =>
      buttons.map(b => ({ text: b.textContent?.replace(/\s+/g, '').trim(), color: (b as HTMLElement).style.color }))
    );
    const homeTab = tabColors.find(t => t.text?.includes('홈'));
    const calendarTab = tabColors.find(t => t.text?.includes('달력'));

    // 홈 탭만 accent, 나머지는 text-secondary
    expect(homeTab?.color).toBe('var(--accent)');
    expect(calendarTab?.color).toBe('var(--text-secondary)');
  });

  test('달력 탭 클릭 시 달력 탭이 활성화되고 달력 콘텐츠가 표시된다', async ({ page }) => {
    await page.getByRole('button', { name: /달력/ }).click();

    // 달력 콘텐츠 표시
    await expect(page.getByText(/Phase 11/)).toBeVisible();

    // 달력 탭 색상이 accent로 변경
    const nav = page.getByRole('navigation');
    const calendarBtn = nav.locator('button').filter({ hasText: '달력' });
    const color = await calendarBtn.evaluate(b => (b as HTMLElement).style.color);
    expect(color).toBe('var(--accent)');
  });

  test('통계 탭 클릭 시 통계 콘텐츠가 표시된다', async ({ page }) => {
    await page.getByRole('button', { name: /통계/ }).click();
    await expect(page.getByText(/Phase 12/)).toBeVisible();
  });

  test('더보기 탭 클릭 시 더보기 콘텐츠가 표시된다', async ({ page }) => {
    await page.getByRole('button', { name: /더보기/ }).click();
    await expect(page.getByText(/Phase 13/)).toBeVisible();
  });

  test('탭 전환 시 이전 탭의 콘텐츠는 사라진다', async ({ page }) => {
    // Phase 10 구현 완료 — HomeTab이 실제 예산 대시보드를 렌더링함
    // 홈 탭: 예산 대시보드의 "예산" 레이블이 로딩 완료 후 표시됨
    await expect(page.getByText('예산').first()).toBeVisible({ timeout: 8000 });

    // 달력으로 전환 → 홈 탭 예산 대시보드가 사라짐
    await page.getByRole('button', { name: /달력/ }).click();
    await expect(page.getByText('예산').first()).not.toBeVisible();
    await expect(page.getByText(/Phase 11/)).toBeVisible();
  });

  // ─── 3. 월 선택기 ───────────────────────────────────────────

  test('홈 탭에서 월 선택기가 현재 월을 표시한다', async ({ page }) => {
    await expect(page.getByText(getCurrentMonthLabel())).toBeVisible();
  });

  test('달력 탭에서도 월 선택기가 표시된다', async ({ page }) => {
    await page.getByRole('button', { name: /달력/ }).click();
    await expect(page.getByRole('button', { name: '이전 달' })).toBeVisible();
    await expect(page.getByText(getCurrentMonthLabel())).toBeVisible();
  });

  test('통계 탭에서도 월 선택기가 표시된다', async ({ page }) => {
    await page.getByRole('button', { name: /통계/ }).click();
    await expect(page.getByRole('button', { name: '이전 달' })).toBeVisible();
  });

  test('더보기 탭에서는 월 선택기가 숨겨진다', async ({ page }) => {
    await page.getByRole('button', { name: /더보기/ }).click();
    await expect(page.getByRole('button', { name: '이전 달' })).not.toBeVisible();
    await expect(page.getByText(getCurrentMonthLabel())).not.toBeVisible();
  });

  test('이전 달 버튼 클릭 시 1개월 전으로 변경된다', async ({ page }) => {
    await page.getByRole('button', { name: '이전 달' }).click();
    await expect(page.getByText(getPrevMonthLabel())).toBeVisible();
  });

  test('다음 달 버튼 클릭 시 1개월 후로 변경된다', async ({ page }) => {
    await page.getByRole('button', { name: '다음 달' }).click();
    await expect(page.getByText(getNextMonthLabel())).toBeVisible();
  });

  test('이전 달 → 다음 달 클릭 시 현재 월로 돌아온다', async ({ page }) => {
    await page.getByRole('button', { name: '이전 달' }).click();
    await page.getByRole('button', { name: '다음 달' }).click();
    await expect(page.getByText(getCurrentMonthLabel())).toBeVisible();
  });

  // ─── 4. 거래 추가 FAB 버튼 ──────────────────────────────────

  test('거래 추가(+) 버튼이 항상 표시된다', async ({ page }) => {
    await expect(page.getByRole('button', { name: '거래 추가' })).toBeVisible();

    // 탭 전환 후에도 유지
    await page.getByRole('button', { name: /달력/ }).click();
    await expect(page.getByRole('button', { name: '거래 추가' })).toBeVisible();
  });

  test('거래 추가 버튼 클릭 시 내역 추가 모달이 열린다', async ({ page }) => {
    await openTransactionForm(page);
    await expect(page.getByRole('heading', { name: '내역 추가' })).toBeVisible();
  });

  // ─── 5. 내역 추가 모달 ──────────────────────────────────────

  test('✕ 버튼 클릭 시 모달이 닫힌다', async ({ page }) => {
    await openTransactionForm(page);
    await page.getByRole('button', { name: '✕' }).click();
    await expect(page.getByRole('heading', { name: '내역 추가' })).not.toBeVisible();
  });

  test('오버레이(배경) 클릭 시 모달이 닫힌다', async ({ page }) => {
    await openTransactionForm(page);
    // 오버레이 영역 클릭 — x=100은 모든 뷰포트(모바일 412px 포함)에서 화면 내에 있고,
    // y=10은 하단 바텀시트 모달 콘텐츠 밖의 상단 빈 영역
    await page.mouse.click(100, 10);
    await expect(page.getByRole('heading', { name: '내역 추가' })).not.toBeVisible();
  });

  test('모달 초기 상태에서 지출 버튼이 활성화된다', async ({ page }) => {
    await openTransactionForm(page);

    const expenseBg = await page.getByRole('button', { name: '지출' })
      .evaluate(b => (b as HTMLElement).style.backgroundColor);
    const incomeBg = await page.getByRole('button', { name: '수입' })
      .evaluate(b => (b as HTMLElement).style.backgroundColor);

    // 지출: 활성(expense 색상), 수입: 비활성(transparent)
    expect(expenseBg).toBe('var(--expense)');
    expect(incomeBg).toBe('transparent');
  });

  test('수입 버튼 클릭 시 수입이 활성화되고 지출이 비활성화된다', async ({ page }) => {
    await openTransactionForm(page);
    await page.getByRole('button', { name: '수입' }).click();

    const expenseBg = await page.getByRole('button', { name: '지출' })
      .evaluate(b => (b as HTMLElement).style.backgroundColor);
    const incomeBg = await page.getByRole('button', { name: '수입' })
      .evaluate(b => (b as HTMLElement).style.backgroundColor);

    expect(incomeBg).toBe('var(--income)');
    expect(expenseBg).toBe('transparent');
  });

  test('날짜 필드의 기본값이 오늘 날짜로 설정된다', async ({ page }) => {
    await openTransactionForm(page);
    await expect(page.locator('input[type="date"]')).toHaveValue(getTodayString());
  });

  test('메모 필드에 placeholder가 표시된다', async ({ page }) => {
    await openTransactionForm(page);
    await expect(page.getByPlaceholder('예: 친구와 점심, 롯데마트')).toBeVisible();
  });

  test('금액 필드에 placeholder 0이 표시된다', async ({ page }) => {
    await openTransactionForm(page);
    await expect(page.getByPlaceholder('0')).toBeVisible();
  });

  test('금액 필드에 숫자만 입력 가능하다', async ({ page }) => {
    await openTransactionForm(page);
    const amountInput = page.getByPlaceholder('0');
    await amountInput.fill('abc');
    await expect(amountInput).toHaveValue('');

    await amountInput.fill('1000');
    await expect(amountInput).toHaveValue('1000');
  });

  test('카테고리 미선택 후 저장 시 유효성 오류 메시지가 표시된다', async ({ page }) => {
    await openTransactionForm(page);
    // 카테고리 칩을 선택하지 않은 채로 저장
    await page.getByRole('button', { name: '저장' }).click();
    await expect(page.getByText('카테고리를 선택해 주세요')).toBeVisible();
  });

  test('카테고리 선택 후 금액 미입력 시 금액 오류 메시지가 표시된다', async ({ page }) => {
    await openTransactionForm(page);
    // 카테고리 칩 선택 후 금액 없이 저장
    await page.getByRole('button', { name: '식비', exact: true }).click();
    await page.getByRole('button', { name: '저장' }).click();
    await expect(page.getByText('금액을 입력해 주세요')).toBeVisible();
  });

  test('저장 성공 시 모달이 닫힌다', async ({ page }) => {
    // POST /transactions 성공 응답으로 모킹
    await page.route('**/transactions', route =>
      route.fulfill({
        json: { id: '1', type: 'expense', date: getTodayString(), category: '식비', amount: 1000, description: '식비', createdAt: new Date().toISOString() }
      })
    );

    await openTransactionForm(page);
    // 카테고리 칩 선택 후 금액 입력
    await page.getByRole('button', { name: '식비', exact: true }).click();
    await page.getByPlaceholder('0').fill('1000');
    await page.getByRole('button', { name: '저장' }).click();

    // 저장 완료 후 모달이 닫혀야 함
    await expect(page.getByRole('heading', { name: '내역 추가' })).not.toBeVisible();
  });

  test('저장 실패 시 오류 메시지가 표시된다', async ({ page }) => {
    // 저장 API 실패 모킹
    await page.route('**/transactions', route =>
      route.fulfill({ status: 500, json: { error: 'Internal Server Error' } })
    );

    await openTransactionForm(page);
    // 카테고리 칩 선택 후 금액 입력
    await page.getByRole('button', { name: '식비', exact: true }).click();
    await page.getByPlaceholder('0').fill('1000');
    await page.getByRole('button', { name: '저장' }).click();

    await expect(page.getByText('저장에 실패했습니다. 다시 시도해 주세요.')).toBeVisible();
  });
});
