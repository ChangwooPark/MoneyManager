import { test, expect } from '@playwright/test';

// ─── 네비게이션 테스트 ─────────────────────────────────────────
// PIN 인증 후 탭 전환, 연월 선택기 동작을 검증합니다.
//
// 인증 우회: 각 테스트 시작 전 addInitScript로 sessionStorage에
// 인증 완료 상태를 미리 주입합니다.

async function bypassAuth(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem('mm_verified', 'true');
  });
  await page.goto('/');
}

test.describe('하단 탭 네비게이션', () => {

  test.beforeEach(async ({ page }) => {
    await bypassAuth(page);
  });

  // ── 테스트 1: 4개 탭이 모두 표시되는가 ──────────────────────
  test('하단에 4개 탭이 모두 표시된다', async ({ page }) => {
    // BottomNav 내부의 탭 버튼을 role로 특정
    // getByText('홈')은 HomeTab 플레이스홀더 텍스트와 중복되므로 role로 구분
    await expect(page.getByRole('button', { name: /🏠.*홈/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /📅.*달력/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /📊.*통계/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /⋯.*더보기/ })).toBeVisible();
  });

  // ── 테스트 2: 달력 탭 전환 ───────────────────────────────────
  test('달력 탭 클릭 시 달력 화면으로 전환된다', async ({ page }) => {
    await page.getByRole('button', { name: /📅.*달력/ }).click();
    await expect(page.getByText('달력 탭')).toBeVisible();
  });

  // ── 테스트 3: 통계 탭 전환 ───────────────────────────────────
  test('통계 탭 클릭 시 통계 화면으로 전환된다', async ({ page }) => {
    await page.getByRole('button', { name: /📊.*통계/ }).click();
    await expect(page.getByText('통계 탭')).toBeVisible();
  });

  // ── 테스트 4: 더보기 탭 전환 + 연월 선택기 숨김 ──────────────
  test('더보기 탭 클릭 시 연월 선택기가 사라진다', async ({ page }) => {
    // 홈 탭에서는 연월 선택기가 보임
    const monthSelector = page.locator('text=/\\d{4}년 \\d+월/');
    await expect(monthSelector).toBeVisible();

    // 더보기 탭으로 이동
    await page.getByRole('button', { name: /⋯.*더보기/ }).click();

    // 더보기 탭에서는 연월 선택기가 사라짐
    await expect(monthSelector).not.toBeVisible();
  });

  // ── 테스트 5: 홈 탭으로 돌아오기 ────────────────────────────
  test('다른 탭에서 홈 탭으로 돌아올 수 있다', async ({ page }) => {
    await page.getByRole('button', { name: /📅.*달력/ }).click();
    await page.getByRole('button', { name: /🏠.*홈/ }).click();
    // 홈 탭에서는 연월 선택기가 다시 보임
    await expect(page.locator('text=/\\d{4}년 \\d+월/')).toBeVisible();
  });
});

test.describe('연월 선택기', () => {

  test.beforeEach(async ({ page }) => {
    await bypassAuth(page);
  });

  // ── 테스트 6: 현재 연월이 표시되는가 ────────────────────────
  test('현재 연월이 표시된다', async ({ page }) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    await expect(page.getByText(`${year}년 ${month}월`)).toBeVisible();
  });

  // ── 테스트 7: 이전 달 이동 ───────────────────────────────────
  // MonthSelector의 이전달 버튼은 aria-label="이전 달" 로 설정되어 있음
  test('이전 달 버튼 클릭 시 이전 달로 이동한다', async ({ page }) => {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevYear = prev.getFullYear();
    const prevMonth = prev.getMonth() + 1;

    await page.getByRole('button', { name: '이전 달' }).click();

    await expect(page.getByText(`${prevYear}년 ${prevMonth}월`)).toBeVisible();
  });

  // ── 테스트 8: 다음 달 이동 ───────────────────────────────────
  test('다음 달 버튼 클릭 시 다음 달로 이동한다', async ({ page }) => {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextYear = next.getFullYear();
    const nextMonth = next.getMonth() + 1;

    await page.getByRole('button', { name: '다음 달' }).click();

    await expect(page.getByText(`${nextYear}년 ${nextMonth}월`)).toBeVisible();
  });
});
