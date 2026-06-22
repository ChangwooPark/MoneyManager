import { test, expect, Page } from '@playwright/test';

// Phase 17 — LINE 알림 설정 E2E 테스트
//
// 검증 대상:
//   더보기 탭의 "LINE 알림" 섹션
//   - 섹션 표시 및 아코디언 열기/닫기
//   - ON/OFF 토글 동작
//   - 테스트 메시지 발송 버튼 동작
//   - 알림 꺼짐 시 테스트 버튼 비활성화

// ─── 공통 모의 설정 ──────────────────────────────────────────

async function goToMoreTab(page: Page, notifEnabled = true): Promise<void> {
  // PIN 인증 모킹
  await page.route('**/settings/pin/verify', route =>
    route.fulfill({ json: { success: true } })
  );
  // 거래 내역 빈 배열
  await page.route('**/transactions*', route => {
    if (route.request().method() === 'GET') {
      route.fulfill({ json: [] });
    } else {
      route.fallback();
    }
  });
  // 예산 없음
  await page.route('**/budgets/**', route =>
    route.fulfill({ status: 404, json: { error: 'Not found' } })
  );
  // 알림 설정 조회
  await page.route('**/notifications/settings', route => {
    if (route.request().method() === 'GET') {
      route.fulfill({ json: { enabled: notifEnabled } });
    } else {
      route.fallback();
    }
  });

  await page.goto('/');
  // PIN 입력
  for (const num of ['1', '2', '3', '4']) {
    await page.getByRole('button', { name: num, exact: true }).click();
  }
  await expect(page.getByRole('navigation')).toBeVisible();
  // 더보기 탭 이동
  await page.getByRole('button', { name: '더보기' }).click();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. 섹션 표시 및 아코디언
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
test.describe('LINE 알림 — 섹션 표시', () => {
  test('더보기 탭에 LINE 알림 항목이 보인다', async ({ page }) => {
    await goToMoreTab(page);
    await expect(page.getByText('LINE 알림')).toBeVisible();
  });

  test('초기 상태(알림 켜짐)에서 "켜짐" 부제목이 표시된다', async ({ page }) => {
    await goToMoreTab(page, true);
    // 더보기 탭 진입 후 알림 설정 로드
    await expect(page.getByText('켜짐')).toBeVisible();
  });

  test('초기 상태(알림 꺼짐)에서 "꺼짐" 부제목이 표시된다', async ({ page }) => {
    await goToMoreTab(page, false);
    await expect(page.getByText('꺼짐')).toBeVisible();
  });

  test('LINE 알림 행을 클릭하면 섹션이 펼쳐진다', async ({ page }) => {
    await goToMoreTab(page);
    await page.getByText('LINE 알림').click();
    await expect(page.getByText('거래 등록 시 LINE 알림')).toBeVisible();
    await expect(page.getByRole('button', { name: '테스트 메시지 발송' })).toBeVisible();
  });

  test('LINE 알림 행을 다시 클릭하면 섹션이 닫힌다', async ({ page }) => {
    await goToMoreTab(page);
    // 아코디언 헤더 버튼을 role 기반으로 선택 (이모지 포함 접근성 이름으로 구별)
    const header = page.getByRole('button', { name: /🔔 LINE 알림/ });
    await header.click();
    await expect(page.getByText('거래 등록 시 LINE 알림')).toBeVisible();
    await header.click();
    await expect(page.getByText('거래 등록 시 LINE 알림')).not.toBeVisible();
  });

  test('다른 섹션을 열면 LINE 알림 섹션이 닫힌다', async ({ page }) => {
    await goToMoreTab(page);
    await page.getByRole('button', { name: /🔔 LINE 알림/ }).click();
    await expect(page.getByText('거래 등록 시 LINE 알림')).toBeVisible();
    // PIN 번호 변경 섹션 클릭
    await page.getByText('PIN 번호 변경').click();
    await expect(page.getByText('거래 등록 시 LINE 알림')).not.toBeVisible();
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2. ON/OFF 토글
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
test.describe('LINE 알림 — ON/OFF 토글', () => {
  test('알림 켜짐 상태에서 토글 클릭 시 꺼짐으로 변경된다', async ({ page }) => {
    // PUT 요청 모킹 — enabled: false 반환
    await page.route('**/notifications/settings', route => {
      if (route.request().method() === 'PUT') {
        route.fulfill({ json: { enabled: false } });
      } else {
        route.fallback();
      }
    });

    await goToMoreTab(page, true);
    await page.getByText('LINE 알림').click();
    await page.getByRole('button', { name: '알림 끄기' }).click();

    // 부제목이 "꺼짐"으로 바뀐다
    await expect(page.getByText('꺼짐')).toBeVisible();
  });

  test('알림 꺼짐 상태에서 토글 클릭 시 켜짐으로 변경된다', async ({ page }) => {
    // PUT 요청 모킹 — enabled: true 반환
    await page.route('**/notifications/settings', route => {
      if (route.request().method() === 'PUT') {
        route.fulfill({ json: { enabled: true } });
      } else {
        route.fallback();
      }
    });

    await goToMoreTab(page, false);
    await page.getByText('LINE 알림').click();
    await page.getByRole('button', { name: '알림 켜기' }).click();

    await expect(page.getByText('켜짐')).toBeVisible();
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3. 테스트 메시지 발송
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
test.describe('LINE 알림 — 테스트 메시지 발송', () => {
  test('테스트 발송 버튼 클릭 시 성공 메시지가 표시된다', async ({ page }) => {
    await page.route('**/notifications/test', route =>
      route.fulfill({ json: { sent: true } })
    );

    await goToMoreTab(page, true);
    await page.getByText('LINE 알림').click();
    await page.getByRole('button', { name: '테스트 메시지 발송' }).click();

    await expect(page.getByText('발송되었습니다 ✓')).toBeVisible();
  });

  test('테스트 발송 실패 시 오류 메시지가 표시된다', async ({ page }) => {
    await page.route('**/notifications/test', route =>
      route.fulfill({ status: 500, json: { sent: false, error: 'LINE API error' } })
    );

    await goToMoreTab(page, true);
    await page.getByText('LINE 알림').click();
    await page.getByRole('button', { name: '테스트 메시지 발송' }).click();

    await expect(page.getByText('발송에 실패했습니다')).toBeVisible();
  });

  test('알림 꺼짐 상태에서 테스트 발송 버튼이 비활성화된다', async ({ page }) => {
    await goToMoreTab(page, false);
    await page.getByText('LINE 알림').click();

    const testBtn = page.getByRole('button', { name: '테스트 메시지 발송' });
    await expect(testBtn).toBeDisabled();
  });

  test('섹션을 닫고 다시 열면 이전 테스트 결과가 초기화된다', async ({ page }) => {
    await page.route('**/notifications/test', route =>
      route.fulfill({ json: { sent: true } })
    );

    await goToMoreTab(page, true);
    await page.getByText('LINE 알림').click();
    await page.getByRole('button', { name: '테스트 메시지 발송' }).click();
    await expect(page.getByText('발송되었습니다 ✓')).toBeVisible();

    const header = page.getByRole('button', { name: /🔔 LINE 알림/ });

    // 섹션 닫기 (이미 열린 상태이므로 role 기반 선택자로 헤더 버튼 클릭)
    await header.click();
    await expect(page.getByText('발송되었습니다 ✓')).not.toBeVisible();

    // 섹션 다시 열기 — 결과 메시지 없음
    await header.click();
    await expect(page.getByText('발송되었습니다 ✓')).not.toBeVisible();
  });
});
