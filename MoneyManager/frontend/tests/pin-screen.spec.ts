import { test, expect } from '@playwright/test';

// PIN 인증 화면 (홈페이지)에 대한 E2E 테스트
//
// 구현 참고 (PinScreen.tsx):
//   - 빈 도트: style.backgroundColor = 'transparent'
//   - 채워진 도트(정상): style.backgroundColor = 'var(--accent)'
//   - 채워진 도트(오류): style.backgroundColor = 'var(--expense)'
//   - API 엔드포인트: POST /settings/pin/verify → { success: boolean }
//   - 오류 후 600ms 뒤 PIN 자동 초기화
//
// 색상 비교는 getComputedStyle 대신 el.style.backgroundColor(인라인 스타일) 사용
// → CSS 변수·브라우저 렌더링 방식에 무관하게 일관된 값을 얻을 수 있음

// 핀 도트 4개의 인라인 backgroundColor 값을 배열로 반환하는 헬퍼
const getDotStyles = (page: import('@playwright/test').Page) =>
  page.locator('.rounded-full').evaluateAll(els =>
    els.map(el => (el as HTMLElement).style.backgroundColor)
  );

test.describe('PIN 인증 화면', () => {
  test.beforeEach(async ({ page }) => {
    // 각 테스트 전 홈페이지로 이동 (React 상태 완전 초기화)
    await page.goto('/');
  });

  // ─── 1. 페이지 기본 렌더링 ───────────────────────────────────

  test('페이지 타이틀이 가계부로 표시된다', async ({ page }) => {
    await expect(page).toHaveTitle('가계부');
    await expect(page.getByText('가계부').first()).toBeVisible();
  });

  test('서브타이틀 PIN 번호를 입력하세요가 표시된다', async ({ page }) => {
    await expect(page.getByText('PIN 번호를 입력하세요')).toBeVisible();
  });

  test('다크 배경 테마가 적용된다', async ({ page }) => {
    // body 배경색이 rgb(15, 15, 15) — 거의 검정인 다크 테마
    const bgColor = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bgColor).toBe('rgb(15, 15, 15)');
  });

  // ─── 2. PIN 도트 인디케이터 ──────────────────────────────────

  test('초기 상태에서 4개의 도트가 모두 빈 상태로 표시된다', async ({ page }) => {
    const dots = page.locator('.rounded-full');
    // 도트가 정확히 4개
    await expect(dots).toHaveCount(4);
    // 모든 도트의 인라인 backgroundColor가 'transparent' (빈 상태)
    const colors = await getDotStyles(page);
    expect(colors.every(c => c === 'transparent')).toBe(true);
  });

  test('숫자 1개 입력 시 첫 번째 도트만 accent 색상으로 채워진다', async ({ page }) => {
    await page.getByRole('button', { name: '1', exact: true }).click();

    const colors = await getDotStyles(page);
    // 첫 번째 도트: var(--accent) 로 채워짐
    expect(colors[0]).toBe('var(--accent)');
    // 나머지 3개: 여전히 빈 상태
    expect(colors.slice(1).every(c => c === 'transparent')).toBe(true);
  });

  test('4개 숫자 입력 시 모든 도트가 채워진다', async ({ page }) => {
    // API 응답을 보류해서 loading 상태(4번째 입력 후)를 유지
    await page.route('**/settings/pin/verify', () => { /* 응답 없음 — loading 상태 유지 */ });

    for (const num of ['1', '2', '3', '4']) {
      await page.getByRole('button', { name: num, exact: true }).click();
    }

    const colors = await getDotStyles(page);
    // 4개 모두 var(--accent)
    expect(colors.every(c => c === 'var(--accent)')).toBe(true);
  });

  // ─── 3. 숫자 패드 버튼 ──────────────────────────────────────

  test('1~9, 0 버튼 10개가 모두 화면에 렌더링된다', async ({ page }) => {
    for (const num of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']) {
      await expect(page.getByRole('button', { name: num, exact: true })).toBeVisible();
    }
  });

  test('빈 자리 플레이스홀더 버튼이 disabled 상태이다', async ({ page }) => {
    // 숫자 패드에서 0 왼쪽 빈 버튼은 key='' 이므로 항상 disabled
    await expect(page.locator('button:disabled')).toHaveCount(1);
  });

  // ─── 4. 백스페이스(⌫) 버튼 ──────────────────────────────────

  test('숫자 입력 후 ⌫ 클릭 시 도트가 1개 줄어든다', async ({ page }) => {
    // 숫자 2개 입력
    await page.getByRole('button', { name: '1', exact: true }).click();
    await page.getByRole('button', { name: '2', exact: true }).click();

    // 백스페이스 1회 → 1개만 남아야 함
    await page.getByRole('button', { name: '⌫' }).click();

    const colors = await getDotStyles(page);
    expect(colors[0]).toBe('var(--accent)'); // 첫 번째만 남음
    expect(colors.slice(1).every(c => c === 'transparent')).toBe(true);
  });

  test('⌫ 클릭 시 마지막 입력이 삭제되어 도트가 초기화된다', async ({ page }) => {
    await page.getByRole('button', { name: '1', exact: true }).click();
    await page.getByRole('button', { name: '⌫' }).click();

    const colors = await getDotStyles(page);
    expect(colors.every(c => c === 'transparent')).toBe(true);
  });

  // ─── 5. PIN 인증 성공 ────────────────────────────────────────

  test('올바른 PIN 입력 시 메인 앱으로 전환된다', async ({ page }) => {
    // API를 성공 응답으로 모킹
    await page.route('**/settings/pin/verify', route =>
      route.fulfill({ json: { success: true } })
    );

    for (const num of ['8', '9', '0', '7']) {
      await page.getByRole('button', { name: num, exact: true }).click();
    }

    // 인증 성공 후 하단 내비게이션이 표시되어야 함
    await expect(page.getByRole('navigation')).toBeVisible();
    await expect(page.getByRole('button', { name: /홈/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /달력/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /통계/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /더보기/ })).toBeVisible();
  });

  test('인증 중(loading) 상태에서 모든 버튼이 비활성화된다', async ({ page }) => {
    // 응답을 지연시켜 loading 상태를 유지
    await page.route('**/settings/pin/verify', async route => {
      await new Promise(resolve => setTimeout(resolve, 5000)); // 5초 대기
      await route.fulfill({ json: { success: true } });
    });

    for (const num of ['1', '2', '3', '4']) {
      await page.getByRole('button', { name: num, exact: true }).click();
    }

    // loading 중에는 key==='' 또는 loading===true → 12개 버튼 모두 disabled
    // (1~9: 9개, 빈칸: 1개, 0: 1개, ⌫: 1개 = 12개)
    await expect(page.locator('button:disabled')).toHaveCount(12);
  });

  // ─── 6. PIN 인증 실패 ────────────────────────────────────────

  test('잘못된 PIN 입력 시 오류 메시지가 표시된다', async ({ page }) => {
    // API를 실패 응답으로 모킹
    await page.route('**/settings/pin/verify', route =>
      route.fulfill({ json: { success: false } })
    );

    for (const num of ['1', '2', '3', '4']) {
      await page.getByRole('button', { name: num, exact: true }).click();
    }

    await expect(page.getByText('PIN 번호가 틀렸습니다')).toBeVisible();
  });

  test('오류 발생 시 도트가 빨간색(--expense)으로 변경된다', async ({ page }) => {
    await page.route('**/settings/pin/verify', route =>
      route.fulfill({ json: { success: false } })
    );

    for (const num of ['1', '2', '3', '4']) {
      await page.getByRole('button', { name: num, exact: true }).click();
    }

    await expect(page.getByText('PIN 번호가 틀렸습니다')).toBeVisible();

    // 오류 상태에서 도트의 인라인 backgroundColor가 var(--expense)
    const colors = await getDotStyles(page);
    expect(colors.every(c => c === 'var(--expense)')).toBe(true);
  });

  test('오류 발생 600ms 후 PIN과 오류 메시지가 자동 초기화된다', async ({ page }) => {
    await page.route('**/settings/pin/verify', route =>
      route.fulfill({ json: { success: false } })
    );

    for (const num of ['1', '2', '3', '4']) {
      await page.getByRole('button', { name: num, exact: true }).click();
    }

    await expect(page.getByText('PIN 번호가 틀렸습니다')).toBeVisible();

    // 600ms 타임아웃 후 자동 초기화 확인 (700ms 여유)
    await page.waitForTimeout(700);

    await expect(page.getByText('PIN 번호가 틀렸습니다')).not.toBeVisible();
    const colors = await getDotStyles(page);
    expect(colors.every(c => c === 'transparent')).toBe(true);
  });

  test('API 네트워크 오류 시에도 오류 메시지가 표시된다', async ({ page }) => {
    // 네트워크 요청 자체를 강제 중단
    await page.route('**/settings/pin/verify', route => route.abort('failed'));

    for (const num of ['1', '2', '3', '4']) {
      await page.getByRole('button', { name: num, exact: true }).click();
    }

    await expect(page.getByText('PIN 번호가 틀렸습니다')).toBeVisible();
  });
});
