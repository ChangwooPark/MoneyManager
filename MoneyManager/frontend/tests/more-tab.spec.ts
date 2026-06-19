import { test, expect, Page } from '@playwright/test';

// MoreTab E2E 테스트 — Phase 13: 더보기 화면
//
// 관련 컴포넌트:
//   - MoreTab.tsx : PIN 변경 / 예산 설정 / 카테고리 관리
//   - api.ts      : changePin, getBudget, setBudget, getCategories, addCategory, deleteCategory
//
// 모킹 전략:
//   page.route()로 백엔드 API를 모킹
//   - PIN 인증  : POST /settings/pin/verify → { success: true }
//   - PIN 변경  : PUT  /settings/pin        → { success: true }
//   - 예산 조회 : GET  /budgets/*           → { yearMonth, amount }
//   - 예산 저장 : PUT  /budgets/*           → { yearMonth, amount }
//   - 카테고리  : GET  /categories*         → MOCK_CATEGORIES
//   - 카테고리 추가: POST /categories       → new category object
//   - 카테고리 삭제: DELETE /categories/*   → 204

// ─── 모의 데이터 ──────────────────────────────────────────────

const MOCK_EXPENSE_CATEGORIES = [
  { id: 'e1', type: 'expense', name: '식비',  order: 0 },
  { id: 'e2', type: 'expense', name: '교통',  order: 1 },
  { id: 'e3', type: 'expense', name: '쇼핑',  order: 2 },
];

const MOCK_INCOME_CATEGORIES = [
  { id: 'i1', type: 'income', name: '급여',  order: 0 },
  { id: 'i2', type: 'income', name: '부업',  order: 1 },
];

const CURRENT_YM = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
})();

// ─── 공통 헬퍼 ────────────────────────────────────────────────

async function setupApp(page: Page): Promise<void> {
  // PIN 화면을 건너뛰기 위해 페이지 로드 전에 sessionStorage 설정
  // (addInitScript는 page.goto 이전에 등록해야 적용됨)
  await page.addInitScript(() => {
    sessionStorage.setItem('mm_verified', 'true');
  });

  // PIN 인증 모킹 (혹시 인증 화면이 나오는 경우 대비)
  await page.route('**/settings/pin/verify', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) })
  );
  // PIN 변경 모킹 (PUT /settings/pin)
  await page.route('**/settings/pin', route => {
    if (route.request().method() === 'PUT') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    }
    route.continue();
  });
  // 예산 조회·저장 모킹
  await page.route('**/budgets/**', route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ yearMonth: CURRENT_YM, amount: 300000 }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ yearMonth: CURRENT_YM, amount: 250000 }) });
  });
  // 카테고리 조회·추가·삭제 모킹
  await page.route('**/categories**', route => {
    const url = route.request().url();
    if (route.request().method() === 'DELETE') {
      return route.fulfill({ status: 204 });
    }
    if (route.request().method() === 'POST') {
      const body = JSON.parse(route.request().postData() ?? '{}');
      return route.fulfill({ status: 201, contentType: 'application/json',
        body: JSON.stringify({ id: 'new1', type: body.type, name: body.name, order: 99 }) });
    }
    if (url.includes('type=income')) {
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(MOCK_INCOME_CATEGORIES) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(MOCK_EXPENSE_CATEGORIES) });
  });
  // 데이터 초기화 API 모킹 (DELETE /transactions/all → { deleted: 5 })
  await page.route('**/transactions/all', route => {
    if (route.request().method() === 'DELETE') {
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ deleted: 5 }) });
    }
    route.continue();
  });

  await page.goto('/');
  // 메인 앱 렌더링 완료 대기
  await page.waitForLoadState('networkidle');
}

async function goToMoreTab(page: Page): Promise<void> {
  await page.getByRole('button', { name: '더보기' }).click();
  await expect(page.getByText('PIN 번호 변경')).toBeVisible({ timeout: 5000 });
}

// ─── 테스트 그룹 ──────────────────────────────────────────────

test.describe('더보기 탭 — 기본 렌더링', () => {

  test('더보기 탭 메뉴 4개(PIN·예산·카테고리·초기화)가 표시된다', async ({ page }) => {
    await setupApp(page);
    await goToMoreTab(page);

    await expect(page.getByText('PIN 번호 변경')).toBeVisible();
    await expect(page.getByText(/예산 설정/)).toBeVisible();
    await expect(page.getByText('카테고리 관리')).toBeVisible();
    await expect(page.getByText('데이터 초기화')).toBeVisible();
  });

  test('예산 메뉴에 현재 설정 금액이 표시된다', async ({ page }) => {
    await setupApp(page);
    await goToMoreTab(page);

    // 현재 예산 ¥300,000 이 서브텍스트로 보여야 함
    await expect(page.getByText('¥300,000')).toBeVisible();
  });

});

test.describe('더보기 탭 — PIN 변경 아코디언', () => {

  test('PIN 변경 헤더 클릭 시 입력 폼이 펼쳐진다', async ({ page }) => {
    await setupApp(page);
    await goToMoreTab(page);

    await page.getByText('PIN 번호 변경').click();

    await expect(page.getByPlaceholder('••••').first()).toBeVisible();
    await expect(page.getByRole('button', { name: '변경 저장' })).toBeVisible();
  });

  test('PIN 변경 헤더 재클릭 시 폼이 접힌다', async ({ page }) => {
    await setupApp(page);
    await goToMoreTab(page);

    await page.getByText('PIN 번호 변경').click();
    await expect(page.getByRole('button', { name: '변경 저장' })).toBeVisible();

    await page.getByText('PIN 번호 변경').click();
    await expect(page.getByRole('button', { name: '변경 저장' })).not.toBeVisible();
  });

  test('새 PIN이 일치하지 않으면 오류 메시지가 표시된다', async ({ page }) => {
    await setupApp(page);
    await goToMoreTab(page);
    await page.getByText('PIN 번호 변경').click();

    const inputs = page.getByPlaceholder('••••');
    await inputs.nth(0).fill('1234'); // 현재 PIN
    await inputs.nth(1).fill('5678'); // 새 PIN
    await inputs.nth(2).fill('9999'); // 다른 확인 PIN

    await page.getByRole('button', { name: '변경 저장' }).click();

    await expect(page.getByText('새 PIN 확인이 일치하지 않습니다')).toBeVisible();
  });

  test('4자리 미만 입력 시 오류 메시지가 표시된다', async ({ page }) => {
    await setupApp(page);
    await goToMoreTab(page);
    await page.getByText('PIN 번호 변경').click();

    const inputs = page.getByPlaceholder('••••');
    await inputs.nth(0).fill('12'); // 2자리 (4자리 미만)

    await page.getByRole('button', { name: '변경 저장' }).click();

    await expect(page.getByText('현재 PIN 4자리를 입력해 주세요')).toBeVisible();
  });

  test('올바른 PIN 변경 시 성공 메시지가 표시된다', async ({ page }) => {
    await setupApp(page);
    await goToMoreTab(page);
    await page.getByText('PIN 번호 변경').click();

    const inputs = page.getByPlaceholder('••••');
    await inputs.nth(0).fill('1234');
    await inputs.nth(1).fill('5678');
    await inputs.nth(2).fill('5678');

    await page.getByRole('button', { name: '변경 저장' }).click();

    await expect(page.getByText('PIN이 변경되었습니다 ✓')).toBeVisible({ timeout: 5000 });
  });

});

test.describe('더보기 탭 — 예산 설정 아코디언', () => {

  test('예산 설정 헤더 클릭 시 금액 입력 폼이 펼쳐진다', async ({ page }) => {
    await setupApp(page);
    await goToMoreTab(page);

    await page.getByText(/예산 설정/).click();

    await expect(page.getByPlaceholder(/예: 300000|300000/)).toBeVisible();
    await expect(page.getByRole('button', { name: '저장' })).toBeVisible();
  });

  test('금액 미입력 시 오류 메시지가 표시된다', async ({ page }) => {
    await setupApp(page);
    await goToMoreTab(page);
    await page.getByText(/예산 설정/).click();

    await page.getByRole('button', { name: '저장' }).click();

    await expect(page.getByText('올바른 금액을 입력해 주세요')).toBeVisible();
  });

  test('올바른 금액 입력 시 저장 후 성공 메시지가 표시된다', async ({ page }) => {
    await setupApp(page);
    await goToMoreTab(page);
    await page.getByText(/예산 설정/).click();

    // placeholder가 현재 예산값(300000)이므로 새 금액 입력
    await page.locator('input[inputmode="numeric"]').fill('250000');

    await page.getByRole('button', { name: '저장' }).click();

    await expect(page.getByText('저장되었습니다 ✓')).toBeVisible({ timeout: 5000 });
  });

});

test.describe('더보기 탭 — 카테고리 관리', () => {

  test('카테고리 관리 클릭 시 카테고리 화면으로 이동한다', async ({ page }) => {
    await setupApp(page);
    await goToMoreTab(page);

    await page.getByText('카테고리 관리').click();

    await expect(page.getByText('← 더보기')).toBeVisible();
    await expect(page.getByRole('heading', { name: '카테고리 관리' }).or(page.locator('h2').filter({ hasText: '카테고리 관리' }))).toBeVisible();
  });

  test('지출 카테고리 목록이 표시된다', async ({ page }) => {
    await setupApp(page);
    await goToMoreTab(page);
    await page.getByText('카테고리 관리').click();

    await expect(page.getByText('식비')).toBeVisible();
    await expect(page.getByText('교통')).toBeVisible();
    await expect(page.getByText('쇼핑')).toBeVisible();
  });

  test('[수입] 탭 클릭 시 수입 카테고리 목록이 표시된다', async ({ page }) => {
    await setupApp(page);
    await goToMoreTab(page);
    await page.getByText('카테고리 관리').click();

    await page.getByRole('button', { name: '수입' }).click();

    await expect(page.getByText('급여')).toBeVisible();
    await expect(page.getByText('부업')).toBeVisible();
    // 지출 카테고리는 보이지 않아야 함
    await expect(page.getByText('식비')).not.toBeVisible();
  });

  test('새 카테고리 추가 시 목록에 나타난다', async ({ page }) => {
    await setupApp(page);
    await goToMoreTab(page);
    await page.getByText('카테고리 관리').click();

    await page.getByPlaceholder('새 카테고리 이름 입력').fill('여행');
    await page.getByRole('button', { name: '추가', exact: true }).click();

    await expect(page.getByText('여행')).toBeVisible({ timeout: 5000 });
  });

  test('카테고리 삭제 버튼 클릭 시 목록에서 제거된다', async ({ page }) => {
    await setupApp(page);
    await goToMoreTab(page);
    await page.getByText('카테고리 관리').click();

    // "식비" span의 부모 행(flex row) div로 이동 후 삭제 버튼 클릭
    // xpath=.. 으로 직계 부모만 선택해 다른 삭제 버튼과 혼동 방지
    await page.locator('span', { hasText: '식비' }).first()
      .locator('xpath=..')
      .getByRole('button', { name: '삭제' })
      .click();

    await expect(page.getByText('식비')).not.toBeVisible({ timeout: 5000 });
  });

  test('← 더보기 클릭 시 메인 메뉴로 돌아온다', async ({ page }) => {
    await setupApp(page);
    await goToMoreTab(page);
    await page.getByText('카테고리 관리').click();

    await page.getByText('← 더보기').click();

    // 메인 메뉴 항목들이 다시 보여야 함
    await expect(page.getByText('PIN 번호 변경')).toBeVisible();
    await expect(page.getByText('카테고리 관리')).toBeVisible();
  });

  test('빈 이름으로 추가 시 오류 메시지가 표시된다', async ({ page }) => {
    await setupApp(page);
    await goToMoreTab(page);
    await page.getByText('카테고리 관리').click();

    // 이름 입력 없이 추가 버튼 클릭 (exact: true — FAB "거래 추가" 버튼과 구분)
    await page.getByRole('button', { name: '추가', exact: true }).click();

    await expect(page.getByText('카테고리 이름을 입력해 주세요')).toBeVisible();
  });

  test('중복 이름 추가 시 오류 메시지가 표시된다', async ({ page }) => {
    await setupApp(page);
    await goToMoreTab(page);
    await page.getByText('카테고리 관리').click();

    // 이미 있는 카테고리 이름 입력
    await page.getByPlaceholder('새 카테고리 이름 입력').fill('식비');
    await page.getByRole('button', { name: '추가', exact: true }).click();

    await expect(page.getByText('이미 존재하는 카테고리입니다')).toBeVisible();
  });

});

test.describe('더보기 탭 — 아코디언 단일 열림', () => {

  test('PIN 열린 상태에서 예산 클릭 → PIN 닫히고 예산 열린다', async ({ page }) => {
    await setupApp(page);
    await goToMoreTab(page);

    // PIN 섹션 열기
    await page.getByText('PIN 번호 변경').click();
    await expect(page.getByRole('button', { name: '변경 저장' })).toBeVisible();

    // 예산 섹션 클릭 → PIN 닫히고 예산 열려야 함
    await page.getByText(/예산 설정/).click();

    await expect(page.getByRole('button', { name: '변경 저장' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: '저장' })).toBeVisible();
  });

  test('예산 열린 상태에서 데이터 초기화 클릭 → 예산 닫히고 초기화 섹션 열린다', async ({ page }) => {
    await setupApp(page);
    await goToMoreTab(page);

    // 예산 섹션 열기
    await page.getByText(/예산 설정/).click();
    await expect(page.getByRole('button', { name: '저장' })).toBeVisible();

    // 데이터 초기화 클릭 → 예산 닫히고 초기화 섹션 열림
    await page.getByText('데이터 초기화').click();

    await expect(page.getByRole('button', { name: '저장' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: '확인' })).toBeVisible();
  });

  test('같은 섹션 재클릭 → 닫힌다', async ({ page }) => {
    await setupApp(page);
    await goToMoreTab(page);

    await page.getByText('데이터 초기화').click();
    await expect(page.getByRole('button', { name: '확인' })).toBeVisible();

    await page.getByText('데이터 초기화').click();
    await expect(page.getByRole('button', { name: '확인' })).not.toBeVisible();
  });

});

test.describe('더보기 탭 — 데이터 초기화', () => {

  test('초기화 헤더 클릭 시 PIN 입력 폼과 안내 문구가 표시된다', async ({ page }) => {
    await setupApp(page);
    await goToMoreTab(page);

    await page.getByText('데이터 초기화').click();

    await expect(page.getByText(/모든 거래 내역이 삭제됩니다/)).toBeVisible();
    await expect(page.getByPlaceholder('••••')).toBeVisible();
    await expect(page.getByRole('button', { name: '확인' })).toBeVisible();
  });

  test('잘못된 PIN 입력 시 오류 메시지가 표시된다', async ({ page }) => {
    await setupApp(page);
    // PIN 검증을 실패로 override (last registered route takes priority)
    await page.route('**/settings/pin/verify', route =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: false }) })
    );
    await goToMoreTab(page);

    await page.getByText('데이터 초기화').click();
    await page.getByPlaceholder('••••').fill('0000');
    await page.getByRole('button', { name: '확인' }).click();

    await expect(page.getByText('PIN이 올바르지 않습니다')).toBeVisible({ timeout: 5000 });
  });

  test('올바른 PIN 입력 후 최종 확인 화면이 표시된다', async ({ page }) => {
    await setupApp(page);
    await goToMoreTab(page);

    await page.getByText('데이터 초기화').click();
    await page.getByPlaceholder('••••').fill('1234');
    await page.getByRole('button', { name: '확인' }).click();

    await expect(page.getByText('⚠️ 모든 거래 내역이 영구 삭제됩니다')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: '초기화', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '취소' })).toBeVisible();
  });

  test('취소 클릭 시 PIN 입력 단계로 돌아간다', async ({ page }) => {
    await setupApp(page);
    await goToMoreTab(page);

    await page.getByText('데이터 초기화').click();
    await page.getByPlaceholder('••••').fill('1234');
    await page.getByRole('button', { name: '확인' }).click();
    await expect(page.getByText('⚠️ 모든 거래 내역이 영구 삭제됩니다')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: '취소' }).click();

    await expect(page.getByPlaceholder('••••')).toBeVisible();
    await expect(page.getByText('⚠️ 모든 거래 내역이 영구 삭제됩니다')).not.toBeVisible();
  });

  test('초기화 확인 클릭 시 성공 메시지가 표시된다', async ({ page }) => {
    await setupApp(page);
    await goToMoreTab(page);

    await page.getByText('데이터 초기화').click();
    await page.getByPlaceholder('••••').fill('1234');
    await page.getByRole('button', { name: '확인' }).click();
    await expect(page.getByText('⚠️ 모든 거래 내역이 영구 삭제됩니다')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: '초기화', exact: true }).click();

    await expect(page.getByText('초기화가 완료되었습니다 ✓')).toBeVisible({ timeout: 5000 });
  });

});
