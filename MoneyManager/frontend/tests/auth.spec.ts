import { test, expect } from '@playwright/test';

// ─── PIN 인증 테스트 ───────────────────────────────────────────
// AppShell이 PIN 입력 화면을 올바르게 표시하고,
// 올바른 PIN / 틀린 PIN 입력 시 동작을 검증합니다.

test.describe('PIN 인증', () => {

  // 백엔드 API를 실제로 호출하는 테스트이므로 타임아웃을 넉넉히 설정
  test.setTimeout(20000);

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  // ── 테스트 1: PIN 입력 화면이 표시되는가 ─────────────────────
  test('앱 진입 시 PIN 입력 화면이 표시된다', async ({ page }) => {
    await expect(page.getByText('PIN 번호를 입력하세요')).toBeVisible();

    for (const digit of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']) {
      await expect(page.getByRole('button', { name: digit, exact: true })).toBeVisible();
    }
  });

  // ── 테스트 2: 올바른 PIN 입력 시 메인 화면으로 이동 ──────────
  // playwright.config.ts의 webServer 설정으로 백엔드가 자동 시작됩니다.
  test('올바른 PIN(8907) 입력 시 메인 화면으로 이동한다', async ({ page }) => {

    for (const digit of ['8', '9', '0', '7']) {
      await page.getByRole('button', { name: digit, exact: true }).click();
    }

    // 인증 완료 후 하단 탭바가 보여야 함
    await expect(page.getByRole('button', { name: /🏠.*홈/ })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: /📅.*달력/ })).toBeVisible();
  });

  // ── 테스트 3: 틀린 PIN 입력 시 오류 표시 ─────────────────────
  test('틀린 PIN 입력 시 오류 메시지가 표시된다', async ({ page }) => {

    for (const digit of ['1', '2', '3', '4']) {
      await page.getByRole('button', { name: digit, exact: true }).click();
    }

    await expect(page.getByText('PIN 번호가 틀렸습니다')).toBeVisible({ timeout: 3000 });
    // 600ms 후 자동 초기화
    await expect(page.getByText('PIN 번호를 입력하세요')).toBeVisible({ timeout: 2000 });
  });

  // ── 테스트 4: PIN 입력 중 ⌫ 버튼으로 삭제 ──────────────────
  test('⌫ 버튼으로 마지막 입력한 숫자를 삭제한다', async ({ page }) => {
    await page.getByRole('button', { name: '8', exact: true }).click();
    await page.getByRole('button', { name: '9', exact: true }).click();
    await page.getByRole('button', { name: '⌫' }).click();

    // 아직 4자리 미완성이므로 PIN 입력 화면 유지
    await expect(page.getByText('PIN 번호를 입력하세요')).toBeVisible();
  });
});
