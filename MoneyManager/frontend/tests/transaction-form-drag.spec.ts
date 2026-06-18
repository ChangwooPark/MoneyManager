import { test, expect, Page, devices } from '@playwright/test';

// 핸들 바 드래그로 모달 닫기 E2E 테스트
//
// Playwright 제약: test.use({ defaultBrowserType }) 는 describe 내 사용 불가
// → 이 파일 최상위에 test.use 선언 (별도 파일로 분리한 이유)
//
// 터치 이벤트 방식 — CDP(Chrome DevTools Protocol):
//   page.evaluate() 내 합성 TouchEvent 는 React 핸들러를 트리거하지 않음
//   (isTrusted=false 또는 Chromium 내부 터치 처리 계층 미통과)
//   CDP Input.dispatchTouchEvent 는 브라우저 네이티브 입력 경로를 통해
//   실제 터치를 에뮬레이션하므로 React onTouchStart/Move/End 가 정상 발화함
//
// 관련 컴포넌트:
//   - TransactionForm.tsx
//     - handleDragStart/Move/End: 핸들 바(.cursor-grab) 터치 핸들러
//     - DISMISS_THRESHOLD = 100: 이 픽셀 이상 아래로 드래그 시 onClose() 호출
//     - dragOffset < DISMISS_THRESHOLD → setDragOffset(0) 스냅백

// ── 파일 최상위 — Pixel 7 에뮬레이션 (Mobile Chrome) ─────────────
// defaultBrowserType 포함이므로 describe 안에서는 사용 불가
test.use({ ...devices['Pixel 7'] });

// ── 헬퍼: PIN API 모킹 후 메인 앱으로 이동 ──────────────────────
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

// ── 헬퍼: 내역 추가 모달 열기 ────────────────────────────────────
async function openTransactionForm(page: Page): Promise<void> {
  await page.getByRole('button', { name: '거래 추가' }).click();
  await expect(page.getByRole('heading', { name: '내역 추가' })).toBeVisible();
}

// ── 헬퍼: CDP로 핸들 바 터치 드래그 시뮬레이션 ──────────────────
// page.evaluate() 의 합성 TouchEvent 는 React 에 전달되지 않으므로
// CDP(Chrome DevTools Protocol) 의 Input.dispatchTouchEvent 를 사용합니다.
// CDP 는 브라우저 네이티브 입력 경로를 통해 진짜 터치를 에뮬레이션합니다.
// Chromium 전용이므로 Mobile Safari(WebKit) 에서는 사용 불가
async function dragHandle(page: Page, dragDistance: number): Promise<void> {
  // 핸들 바 중심 좌표 계산
  const box = await page.locator('.cursor-grab').boundingBox();
  if (!box) throw new Error('.cursor-grab 요소를 찾을 수 없습니다.');

  const cx = Math.round(box.x + box.width / 2);
  const cy = Math.round(box.y + box.height / 2);
  const targetY = Math.round(cy + dragDistance);

  // CDP 세션 생성 — Chromium 전용 API
  const client = await page.context().newCDPSession(page);

  const point = (y: number) => ({
    x: cx, y,
    radiusX: 1, radiusY: 1,
    rotationAngle: 0, force: 1,
    id: 1,
  });

  // touchstart
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [point(cy)],
    modifiers: 0,
  });

  // touchmove — 중간 지점
  await page.waitForTimeout(16); // 1프레임 대기
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [point(cy + Math.round(dragDistance * 0.5))],
    modifiers: 0,
  });

  // touchmove — 목표 지점
  await page.waitForTimeout(16);
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [point(targetY)],
    modifiers: 0,
  });

  // touchend
  await page.waitForTimeout(16);
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
    modifiers: 0,
  });

  await client.detach();
}

// ── 헬퍼: 위 방향(음수) 드래그 ───────────────────────────────────
async function dragHandleUp(page: Page, dragDistance: number): Promise<void> {
  const box = await page.locator('.cursor-grab').boundingBox();
  if (!box) throw new Error('.cursor-grab 요소를 찾을 수 없습니다.');

  const cx = Math.round(box.x + box.width / 2);
  const cy = Math.round(box.y + box.height / 2);

  const client = await page.context().newCDPSession(page);
  const point = (y: number) => ({ x: cx, y, radiusX: 1, radiusY: 1, rotationAngle: 0, force: 1, id: 1 });

  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(cy)], modifiers: 0 });
  await page.waitForTimeout(16);
  await client.send('Input.dispatchTouchEvent', { type: 'touchMove',  touchPoints: [point(cy - dragDistance)], modifiers: 0 });
  await page.waitForTimeout(16);
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd',   touchPoints: [], modifiers: 0 });

  await client.detach();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 핸들 바 드래그로 모달 닫기 — CDP 터치 에뮬레이션 (Pixel 7)
//   임계값: DISMISS_THRESHOLD = 100px (TransactionForm.tsx 상수)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
test.describe('핸들 바 드래그로 모달 닫기', () => {
  test.beforeEach(async ({ page }) => {
    await goToMainApp(page);
    await openTransactionForm(page);
  });

  test('110px 아래 드래그 → 모달이 닫힌다 (임계값 100px 초과)', async ({ page }) => {
    await dragHandle(page, 110);
    await expect(page.getByRole('heading', { name: '내역 추가' })).not.toBeVisible({ timeout: 3000 });
  });

  test('101px 드래그 → 모달이 닫힌다 (임계값 경계 바로 초과)', async ({ page }) => {
    await dragHandle(page, 101);
    await expect(page.getByRole('heading', { name: '내역 추가' })).not.toBeVisible({ timeout: 3000 });
  });

  test('50px 드래그 → 모달이 닫히지 않는다 (임계값 미만, 스냅백)', async ({ page }) => {
    await dragHandle(page, 50);
    await expect(page.getByRole('heading', { name: '내역 추가' })).toBeVisible();
  });

  test('50px 드래그 스냅백 후 → 시트가 translateY(0px) 으로 복귀한다', async ({ page }) => {
    await dragHandle(page, 50);
    // transition: 0.3s cubic-bezier 애니메이션 완료 대기
    await page.waitForTimeout(400);

    const transform = await page.locator('.rounded-t-2xl').evaluate(
      el => (el as HTMLElement).style.transform
    );
    expect(transform).toBe('translateY(0px)');
  });

  test('위 방향(음수) 드래그 → 모달이 닫히지 않는다', async ({ page }) => {
    // handleDragMove: delta > 0 만 허용 → 위 드래그 시 dragOffset 변화 없음
    await dragHandleUp(page, 150);
    await expect(page.getByRole('heading', { name: '내역 추가' })).toBeVisible();
  });

  test('드래그 중 오버레이가 투명해진다 (dragOffset 증가에 따라 opacity 감소)', async ({ page }) => {
    // 80px 드래그 후 touchend 없이 — 드래그 중 상태 유지
    const box = await page.locator('.cursor-grab').boundingBox();
    if (!box) throw new Error('.cursor-grab 요소를 찾을 수 없습니다.');
    const cx = Math.round(box.x + box.width / 2);
    const cy = Math.round(box.y + box.height / 2);

    const client = await page.context().newCDPSession(page);
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: cx, y: cy, radiusX: 1, radiusY: 1, rotationAngle: 0, force: 1, id: 1 }],
      modifiers: 0,
    });
    await page.waitForTimeout(16);
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: cx, y: cy + 80, radiusX: 1, radiusY: 1, rotationAngle: 0, force: 1, id: 1 }],
      modifiers: 0,
    });
    await page.waitForTimeout(50);

    // dragOffset=80 → opacity = max(0.05, 0.6 - 80/400) = 0.4
    const overlayBg = await page.locator('.fixed.inset-0').evaluate(
      el => (el as HTMLElement).style.backgroundColor
    );
    const alphaMatch = overlayBg.match(/rgba\(0,\s*0,\s*0,\s*([\d.]+)\)/);
    if (alphaMatch) {
      const alpha = parseFloat(alphaMatch[1]);
      expect(alpha).toBeLessThan(0.6);
      expect(alpha).toBeGreaterThan(0);
    }

    // 정리: touchend 발행하여 상태 복귀
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [], modifiers: 0 });
    await client.detach();
  });
});
