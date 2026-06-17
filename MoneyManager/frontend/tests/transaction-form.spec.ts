import { test, expect } from '@playwright/test';

// ─── 거래 내역 입력 폼 테스트 ──────────────────────────────────
// FAB 버튼, 바텀 시트 폼 열기/닫기, 입력 유효성 검사를 검증합니다.
//
// 주의: '저장' 테스트는 백엔드(http://localhost:8080)가 실행 중이어야 합니다.

async function bypassAuth(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem('mm_verified', 'true');
  });
  await page.goto('/');
}

test.describe('FAB 버튼', () => {

  test.beforeEach(async ({ page }) => {
    await bypassAuth(page);
  });

  // ── 테스트 1: FAB 버튼이 표시되는가 ─────────────────────────
  test('+ FAB 버튼이 화면에 표시된다', async ({ page }) => {
    await expect(page.getByRole('button', { name: '거래 추가' })).toBeVisible();
  });

  // ── 테스트 2: FAB 클릭 시 폼이 열리는가 ─────────────────────
  test('FAB 버튼 클릭 시 거래 입력 폼이 열린다', async ({ page }) => {
    await page.getByRole('button', { name: '거래 추가' }).click();
    await expect(page.getByText('내역 추가')).toBeVisible();
  });
});

test.describe('거래 입력 폼 UI', () => {

  test.beforeEach(async ({ page }) => {
    await bypassAuth(page);
    await page.getByRole('button', { name: '거래 추가' }).click();
    await expect(page.getByText('내역 추가')).toBeVisible();
  });

  // ── 테스트 3: 폼 필드가 모두 표시되는가 ─────────────────────
  test('필수 입력 필드가 모두 표시된다', async ({ page }) => {
    await expect(page.getByText('날짜')).toBeVisible();
    await expect(page.getByText('내용')).toBeVisible();
    await expect(page.getByText('금액')).toBeVisible();
    await expect(page.getByText('메모')).toBeVisible();
    await expect(page.getByRole('button', { name: '저장' })).toBeVisible();
  });

  // ── 테스트 4: 수입/지출 토글 ─────────────────────────────────
  test('지출/수입 토글이 동작한다', async ({ page }) => {
    await expect(page.getByRole('button', { name: '지출' })).toBeVisible();
    await expect(page.getByRole('button', { name: '수입' })).toBeVisible();
    // 수입 클릭 후에도 폼이 정상 표시
    await page.getByRole('button', { name: '수입' }).click();
    await expect(page.getByRole('button', { name: '저장' })).toBeVisible();
  });

  // ── 테스트 5: ✕ 버튼으로 폼 닫기 ───────────────────────────
  test('✕ 버튼 클릭 시 폼이 닫힌다', async ({ page }) => {
    await page.getByRole('button', { name: '✕' }).click();
    await expect(page.getByText('내역 추가')).not.toBeVisible();
    // BottomNav의 홈 탭 버튼이 보임
    await expect(page.getByRole('button', { name: /🏠.*홈/ })).toBeVisible();
  });

  // ── 테스트 6: 오버레이 클릭으로 폼 닫기 ─────────────────────
  test('배경 오버레이 클릭 시 폼이 닫힌다', async ({ page }) => {
    await page.mouse.click(10, 10);
    await expect(page.getByText('내역 추가')).not.toBeVisible();
  });

  // ── 테스트 7: 내용 없이 저장 시 오류 메시지 ─────────────────
  test('내용 미입력 시 저장하면 오류 메시지가 표시된다', async ({ page }) => {
    await page.getByRole('button', { name: '저장' }).click();
    await expect(page.getByText('카테고리를 입력해 주세요')).toBeVisible();
  });

  // ── 테스트 8: 금액 없이 저장 시 오류 메시지 ─────────────────
  test('금액 미입력 시 저장하면 오류 메시지가 표시된다', async ({ page }) => {
    await page.getByPlaceholder('예: 점심 식사, 교통비').fill('테스트');
    await page.getByRole('button', { name: '저장' }).click();
    await expect(page.getByText('금액을 입력해 주세요')).toBeVisible();
  });

  // ── 테스트 9: 금액 입력 시 엔화 미리보기 표시 ───────────────
  test('금액 입력 시 ¥ 포맷 미리보기가 표시된다', async ({ page }) => {
    await page.getByPlaceholder('0').fill('1500');
    await expect(page.getByText('¥1,500')).toBeVisible();
  });

  // ── 테스트 10: 날짜 기본값이 오늘인가 ───────────────────────
  test('날짜 기본값이 오늘 날짜이다', async ({ page }) => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;

    await expect(page.locator('input[type="date"]')).toHaveValue(todayStr);
  });
});

test.describe('거래 저장 (백엔드 연동)', () => {

  // playwright.config.ts의 webServer 설정으로 백엔드가 자동 시작됩니다.

  test.beforeEach(async ({ page }) => {
    await bypassAuth(page);
    await page.getByRole('button', { name: '거래 추가' }).click();
    await expect(page.getByText('내역 추가')).toBeVisible();
  });

  // ── 테스트 11: 정상 저장 후 폼이 닫히는가 ───────────────────
  test('내용과 금액 입력 후 저장하면 폼이 닫힌다', async ({ page }) => {
    await page.getByPlaceholder('예: 점심 식사, 교통비').fill('E2E 테스트용 내역');
    await page.getByPlaceholder('0').fill('100');
    await page.getByRole('button', { name: '저장' }).click();

    // 저장 성공 시 폼이 닫히고 메인 화면으로 돌아옴
    await expect(page.getByText('내역 추가')).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: /🏠.*홈/ })).toBeVisible();
  });
});
