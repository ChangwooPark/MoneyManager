import { test, expect, Page } from '@playwright/test';

// 카테고리 칩 선택 + 핸들 바 드래그로 닫기 E2E 테스트
//
// 탐색 환경 (Playwright MCP):
//   - 지출 카테고리 9개: 식비·교통·쇼핑·의료·통신·여가·공과금·생활·기타
//   - 수입 카테고리 5개: 급여·부업·이자·보너스·기타
//   - 칩 선택 시 style: backgroundColor=var(--expense|--income), color=rgb(0,0,0)
//   - 비선택 칩: backgroundColor=var(--bg-card)
//   - 카테고리 미선택 저장 → "카테고리를 선택해 주세요"
//   - 핸들 바(.cursor-grab): centerY≈30px, 100px 초과 드래그 시 onClose() 호출
//
// 관련 컴포넌트:
//   - TransactionForm.tsx : CATEGORIES 상수, handleTypeChange(초기화), handleDragEnd(임계값 100px)
//
// WebKit 제외 이유:
//   - 로컬 WebKit 바이너리 Bus error 충돌
//
// 드래그 테스트 제약:
//   - 데스크탑 Chromium: maxTouchPoints=0 → TouchEvent가 React에 전달 안 됨
//   - Mobile Chrome 에뮬레이션(Pixel 7): maxTouchPoints=5 → 터치 이벤트 정상 동작

// 코드와 동기화된 카테고리 목록 (TransactionForm.tsx CATEGORIES 상수와 일치)
const EXPENSE_CATEGORIES = ['식비', '교통', '쇼핑', '의료', '통신', '여가', '공과금', '생활', '기타'] as const;
const INCOME_CATEGORIES  = ['급여', '부업', '이자', '보너스', '기타'] as const;

// 지출 전용 카테고리 (수입 전환 시 사라져야 하는 것들, '기타' 제외)
const EXPENSE_ONLY = ['식비', '교통', '쇼핑', '의료', '통신', '여가', '공과금', '생활'] as const;
// 수입 전용 카테고리 ('기타' 제외)
const INCOME_ONLY  = ['급여', '부업', '이자', '보너스'] as const;

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

// ── 헬퍼: 칩의 현재 배경색 반환 ──────────────────────────────────
function getChipBg(page: Page, name: string): Promise<string> {
  return page.getByRole('button', { name, exact: true })
    .evaluate(b => (b as HTMLElement).style.backgroundColor);
}

// ── 헬퍼: 핸들 바 터치 드래그 시뮬레이션 ────────────────────────
// Mobile Chrome 에뮬레이션 환경(maxTouchPoints > 0)에서만 작동합니다.
// TouchEvent를 직접 dispatch하여 React의 onTouchStart/Move/End 핸들러를 트리거합니다.
async function simulateHandleDrag(page: Page, dragDistance: number): Promise<void> {
  await page.evaluate((distance: number) => {
    const handle = document.querySelector('.cursor-grab');
    if (!handle) return;
    const rect = handle.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    // Touch 객체 생성 헬퍼 — TypeScript as 문법 대신 순수 JS로 작성
    function makeTouch(x: number, y: number) {
      return new Touch({ identifier: 1, target: handle!, clientX: x, clientY: y,
        screenX: x, screenY: y, pageX: x, pageY: y, radiusX: 1, radiusY: 1, rotationAngle: 0, force: 1 });
    }

    function makeOpts(x: number, y: number, ended = false) {
      const t = makeTouch(x, y);
      return {
        bubbles: true, cancelable: true,
        touches:        ended ? [] : [t],
        targetTouches:  ended ? [] : [t],
        changedTouches: [t],
      };
    }

    // 드래그: 시작 → 중간 → 끝 → 종료
    handle.dispatchEvent(new TouchEvent('touchstart', makeOpts(cx, cy)));
    handle.dispatchEvent(new TouchEvent('touchmove',  makeOpts(cx, cy + distance * 0.5)));
    handle.dispatchEvent(new TouchEvent('touchmove',  makeOpts(cx, cy + distance)));
    handle.dispatchEvent(new TouchEvent('touchend',   makeOpts(cx, cy + distance, true)));
  }, dragDistance);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. 카테고리 칩 — 지출 모드
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
test.describe('카테고리 칩 선택 — 지출 모드', () => {
  test.skip(({ browserName }) => browserName === 'webkit',
    'WebKit 바이너리 충돌(Bus error)로 건너뜁니다.');

  test.beforeEach(async ({ page }) => {
    await goToMainApp(page);
    await openTransactionForm(page);
    // 기본값이 지출이므로 별도 클릭 불필요
  });

  test('모달 열리면 지출 카테고리 9개가 모두 표시된다', async ({ page }) => {
    for (const cat of EXPENSE_CATEGORIES) {
      await expect(page.getByRole('button', { name: cat, exact: true })).toBeVisible();
    }
  });

  test('초기 진입 시 어떤 카테고리 칩도 선택되지 않은 상태다', async ({ page }) => {
    for (const cat of EXPENSE_CATEGORIES) {
      expect(await getChipBg(page, cat)).toBe('var(--bg-card)');
    }
  });

  test('식비 칩 클릭 시 expense 강조색(var(--expense))으로 활성화된다', async ({ page }) => {
    await page.getByRole('button', { name: '식비', exact: true }).click();

    const style = await page.getByRole('button', { name: '식비', exact: true })
      .evaluate(b => ({
        bg:    (b as HTMLElement).style.backgroundColor,
        color: (b as HTMLElement).style.color,
        border:(b as HTMLElement).style.border,
      }));

    // 선택된 칩은 expense 강조색 + 검정 텍스트 + expense 테두리
    expect(style.bg).toBe('var(--expense)');
    expect(style.color).toBe('rgb(0, 0, 0)');
    expect(style.border).toBe('1px solid var(--expense)');
  });

  test('교통 칩 클릭 후 쇼핑 칩 클릭 시 — 교통이 비활성화되고 쇼핑이 활성화된다', async ({ page }) => {
    await page.getByRole('button', { name: '교통', exact: true }).click();
    await page.getByRole('button', { name: '쇼핑', exact: true }).click();

    // 이전 선택(교통)은 비선택 상태로 복귀
    expect(await getChipBg(page, '교통')).toBe('var(--bg-card)');
    // 새 선택(쇼핑)은 활성화
    expect(await getChipBg(page, '쇼핑')).toBe('var(--expense)');
  });

  test('어느 시점에나 최대 1개의 칩만 선택된다', async ({ page }) => {
    await page.getByRole('button', { name: '식비', exact: true }).click();
    await page.getByRole('button', { name: '의료', exact: true }).click();

    // 식비를 제외한 나머지 8개는 모두 비선택
    const selectedChips = [];
    for (const cat of EXPENSE_CATEGORIES) {
      const bg = await getChipBg(page, cat);
      if (bg === 'var(--expense)') selectedChips.push(cat);
    }
    expect(selectedChips).toHaveLength(1);
    expect(selectedChips[0]).toBe('의료');
  });

  test('카테고리 미선택 후 저장 버튼 클릭 → "카테고리를 선택해 주세요" 오류가 표시된다', async ({ page }) => {
    await page.getByRole('button', { name: '저장' }).click();
    await expect(page.getByText('카테고리를 선택해 주세요')).toBeVisible();
    // 모달은 닫히지 않아야 함
    await expect(page.getByRole('heading', { name: '내역 추가' })).toBeVisible();
  });

  test('카테고리 선택 후 금액 미입력 시 "금액을 입력해 주세요" 오류가 표시된다', async ({ page }) => {
    await page.getByRole('button', { name: '식비', exact: true }).click();
    await page.getByRole('button', { name: '저장' }).click();
    await expect(page.getByText('금액을 입력해 주세요')).toBeVisible();
  });

  test('수입 전용 카테고리(급여·부업·이자·보너스)는 지출 모드에서 보이지 않는다', async ({ page }) => {
    for (const cat of INCOME_ONLY) {
      await expect(page.getByRole('button', { name: cat, exact: true })).not.toBeVisible();
    }
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2. 카테고리 칩 — 수입 모드
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
test.describe('카테고리 칩 선택 — 수입 모드', () => {
  test.skip(({ browserName }) => browserName === 'webkit',
    'WebKit 바이너리 충돌(Bus error)로 건너뜁니다.');

  test.beforeEach(async ({ page }) => {
    await goToMainApp(page);
    await openTransactionForm(page);
    await page.getByRole('button', { name: '수입' }).click();
  });

  test('수입 전환 시 수입 카테고리 5개가 모두 표시된다', async ({ page }) => {
    for (const cat of INCOME_CATEGORIES) {
      await expect(page.getByRole('button', { name: cat, exact: true })).toBeVisible();
    }
  });

  test('수입 전환 시 지출 전용 카테고리(식비·교통 등)가 사라진다', async ({ page }) => {
    for (const cat of EXPENSE_ONLY) {
      await expect(page.getByRole('button', { name: cat, exact: true })).not.toBeVisible();
    }
  });

  test('급여 칩 클릭 시 income 강조색(var(--income))으로 활성화된다', async ({ page }) => {
    await page.getByRole('button', { name: '급여', exact: true }).click();

    const style = await page.getByRole('button', { name: '급여', exact: true })
      .evaluate(b => ({
        bg:    (b as HTMLElement).style.backgroundColor,
        color: (b as HTMLElement).style.color,
        border:(b as HTMLElement).style.border,
      }));

    expect(style.bg).toBe('var(--income)');
    expect(style.color).toBe('rgb(0, 0, 0)');
    expect(style.border).toBe('1px solid var(--income)');
  });

  test('수입 모드에서도 카테고리 미선택 저장 시 오류가 표시된다', async ({ page }) => {
    await page.getByRole('button', { name: '저장' }).click();
    await expect(page.getByText('카테고리를 선택해 주세요')).toBeVisible();
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3. 카테고리 칩 — 수입↔지출 전환 시 선택 초기화
//    handleTypeChange() 에서 setCategory('') 를 호출하여 리셋합니다.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
test.describe('카테고리 칩 — 수입↔지출 전환 시 선택 초기화', () => {
  test.skip(({ browserName }) => browserName === 'webkit',
    'WebKit 바이너리 충돌(Bus error)로 건너뜁니다.');

  test.beforeEach(async ({ page }) => {
    await goToMainApp(page);
    await openTransactionForm(page);
  });

  test('지출 칩(식비) 선택 → 수입 전환 → 지출 재전환 시 선택이 초기화된다', async ({ page }) => {
    await page.getByRole('button', { name: '식비', exact: true }).click();
    expect(await getChipBg(page, '식비')).toBe('var(--expense)'); // 선택 확인

    await page.getByRole('button', { name: '수입' }).click();
    await page.getByRole('button', { name: '지출' }).click();

    // 지출로 돌아온 뒤 식비 칩이 비선택 상태여야 함
    expect(await getChipBg(page, '식비')).toBe('var(--bg-card)');
  });

  test('수입 칩(급여) 선택 → 지출 전환 시 선택이 초기화되고 지출 칩들도 비선택 상태다', async ({ page }) => {
    await page.getByRole('button', { name: '수입' }).click();
    await page.getByRole('button', { name: '급여', exact: true }).click();

    await page.getByRole('button', { name: '지출' }).click();

    // 지출 칩들이 모두 비선택 상태여야 함
    for (const cat of EXPENSE_CATEGORIES) {
      expect(await getChipBg(page, cat)).toBe('var(--bg-card)');
    }
  });

  test('전환 후 카테고리 미선택 상태에서 저장 클릭 → 오류가 표시된다', async ({ page }) => {
    // 지출 칩 선택 후 수입으로 전환 (선택 초기화)
    await page.getByRole('button', { name: '식비', exact: true }).click();
    await page.getByRole('button', { name: '수입' }).click();

    // 수입 모드에서 카테고리 미선택 상태로 저장 시도
    await page.getByRole('button', { name: '저장' }).click();
    await expect(page.getByText('카테고리를 선택해 주세요')).toBeVisible();
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 4. 카테고리 칩 — 저장 API 연동
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
test.describe('카테고리 칩 — 저장 API 연동', () => {
  test.skip(({ browserName }) => browserName === 'webkit',
    'WebKit 바이너리 충돌(Bus error)로 건너뜁니다.');

  test.beforeEach(async ({ page }) => {
    await goToMainApp(page);
    await openTransactionForm(page);
  });

  test('카테고리 + 금액 입력 후 저장 성공 시 모달이 닫힌다', async ({ page }) => {
    await page.route('**/transactions', route =>
      route.fulfill({ json: { id: '1', type: 'expense', category: '식비',
        amount: 1000, date: '2026-06-18', description: '식비', createdAt: new Date().toISOString() } })
    );

    await page.getByRole('button', { name: '식비', exact: true }).click();
    await page.getByPlaceholder('0').fill('1000');
    await page.getByRole('button', { name: '저장' }).click();

    await expect(page.getByRole('heading', { name: '내역 추가' })).not.toBeVisible();
  });

  test('카테고리 + 금액 + 메모 입력 후 저장 성공 시 모달이 닫힌다', async ({ page }) => {
    await page.route('**/transactions', route =>
      route.fulfill({ json: { id: '2', type: 'expense', category: '식비',
        amount: 2000, date: '2026-06-18', description: '친구와 점심', memo: '친구와 점심',
        createdAt: new Date().toISOString() } })
    );

    await page.getByRole('button', { name: '식비', exact: true }).click();
    await page.getByPlaceholder('0').fill('2000');
    await page.getByPlaceholder('예: 친구와 점심, 롯데마트').fill('친구와 점심');
    await page.getByRole('button', { name: '저장' }).click();

    await expect(page.getByRole('heading', { name: '내역 추가' })).not.toBeVisible();
  });

  test('수입 카테고리(급여) 선택 후 저장 성공 시 모달이 닫힌다', async ({ page }) => {
    await page.route('**/transactions', route =>
      route.fulfill({ json: { id: '3', type: 'income', category: '급여',
        amount: 300000, date: '2026-06-18', description: '급여', createdAt: new Date().toISOString() } })
    );

    await page.getByRole('button', { name: '수입' }).click();
    await page.getByRole('button', { name: '급여', exact: true }).click();
    await page.getByPlaceholder('0').fill('300000');
    await page.getByRole('button', { name: '저장' }).click();

    await expect(page.getByRole('heading', { name: '내역 추가' })).not.toBeVisible();
  });

  test('저장 API 실패 시 오류 메시지가 표시되고 모달이 닫히지 않는다', async ({ page }) => {
    await page.route('**/transactions', route =>
      route.fulfill({ status: 500, json: { error: 'Internal Server Error' } })
    );

    await page.getByRole('button', { name: '식비', exact: true }).click();
    await page.getByPlaceholder('0').fill('1000');
    await page.getByRole('button', { name: '저장' }).click();

    await expect(page.getByText('저장에 실패했습니다. 다시 시도해 주세요.')).toBeVisible();
    await expect(page.getByRole('heading', { name: '내역 추가' })).toBeVisible();
  });
});

// 드래그 관련 테스트는 transaction-form-drag.spec.ts 파일에서 관리합니다.
// (Playwright 제약: test.use({ defaultBrowserType }) 는 describe 블록 내 사용 불가 — 파일 최상위에만 가능)
