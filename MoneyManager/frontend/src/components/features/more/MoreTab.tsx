'use client';

import { useState, useEffect } from 'react';
import { changePin, getBudget, setBudget, getCategories, addCategory, deleteCategory } from '@/lib/api';
import { Category } from '@/types';

// ─── 현재 연월 헬퍼 ──────────────────────────────────────────
// 예산 설정은 이번 달 기준으로 동작합니다.
function getCurrentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getCurrentYearMonthLabel(): string {
  const d = new Date();
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
}

// ─── 타입 정의 ───────────────────────────────────────────────
type MoreView     = 'main' | 'categories';
type CategoryTab  = 'expense' | 'income';

// ─── MoreTab 컴포넌트 ─────────────────────────────────────────
// 더보기 탭 화면입니다.
// - 메인 뷰: PIN 번호 변경 / 예산 설정 / 카테고리 관리 메뉴
// - 카테고리 관리 뷰: 지출·수입 카테고리 추가·삭제
export default function MoreTab() {
  // 현재 화면: 메인 메뉴 또는 카테고리 관리
  const [view, setView] = useState<MoreView>('main');

  // ── 아코디언 열림 상태 ───────────────────────────────────────
  // 각 섹션(PIN·예산)은 헤더 클릭 시 폼이 펼쳐집니다.
  const [pinOpen,    setPinOpen]    = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);

  // ─────────────────────────────────────────────────────────────
  // PIN 번호 변경 상태
  // ─────────────────────────────────────────────────────────────
  const [currentPin,  setCurrentPin]  = useState('');
  const [newPin,      setNewPin]      = useState('');
  const [confirmPin,  setConfirmPin]  = useState('');
  const [pinLoading,  setPinLoading]  = useState(false);
  const [pinError,    setPinError]    = useState('');
  const [pinSuccess,  setPinSuccess]  = useState(false);

  // ─────────────────────────────────────────────────────────────
  // 예산 설정 상태
  // ─────────────────────────────────────────────────────────────
  const yearMonth = getCurrentYearMonth();
  const [budgetInput,   setBudgetInput]   = useState('');
  const [currentBudget, setCurrentBudget] = useState<number | null>(null);
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [budgetError,   setBudgetError]   = useState('');
  const [budgetSuccess, setBudgetSuccess] = useState(false);

  // ─────────────────────────────────────────────────────────────
  // 카테고리 관리 상태
  // ─────────────────────────────────────────────────────────────
  const [catTab,       setCatTab]       = useState<CategoryTab>('expense');
  const [categories,   setCategories]   = useState<Category[]>([]);
  const [catLoading,   setCatLoading]   = useState(false);
  const [newCatName,   setNewCatName]   = useState('');
  const [catAddLoad,   setCatAddLoad]   = useState(false);
  const [catError,     setCatError]     = useState('');

  // ── 현재 월 예산 조회 (마운트 시) ─────────────────────────────
  useEffect(() => {
    getBudget(yearMonth)
      .then(b => setCurrentBudget(b.amount))
      .catch(() => setCurrentBudget(null)); // 예산 미설정 시 null
  }, [yearMonth]);

  // ── 카테고리 목록 조회 (카테고리 뷰 진입 또는 탭 전환 시) ────
  useEffect(() => {
    if (view !== 'categories') return;
    let cancelled = false;
    setCatLoading(true);
    setCatError('');
    getCategories(catTab)
      .then(list => { if (!cancelled) setCategories(list); })
      .catch(() => { if (!cancelled) setCatError('불러오기 실패'); })
      .finally(() => { if (!cancelled) setCatLoading(false); });
    return () => { cancelled = true; };
  }, [view, catTab]);

  // ─────────────────────────────────────────────────────────────
  // PIN 변경 저장
  // ─────────────────────────────────────────────────────────────
  const handlePinSave = async () => {
    setPinError('');
    setPinSuccess(false);
    if (!/^\d{4}$/.test(currentPin)) { setPinError('현재 PIN 4자리를 입력해 주세요'); return; }
    if (!/^\d{4}$/.test(newPin))     { setPinError('새 PIN 4자리를 입력해 주세요'); return; }
    if (newPin !== confirmPin)        { setPinError('새 PIN 확인이 일치하지 않습니다'); return; }

    setPinLoading(true);
    try {
      const res = await changePin(currentPin, newPin);
      if (res.success) {
        setPinSuccess(true);
        setCurrentPin(''); setNewPin(''); setConfirmPin('');
        // 1.5초 후 성공 메시지 숨기고 닫기
        setTimeout(() => { setPinSuccess(false); setPinOpen(false); }, 1500);
      } else {
        setPinError('현재 PIN이 올바르지 않습니다');
      }
    } catch {
      setPinError('저장에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setPinLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 예산 저장
  // ─────────────────────────────────────────────────────────────
  const handleBudgetSave = async () => {
    setBudgetError('');
    setBudgetSuccess(false);
    const amount = Number(budgetInput);
    if (!budgetInput || isNaN(amount) || amount <= 0) {
      setBudgetError('올바른 금액을 입력해 주세요');
      return;
    }

    setBudgetLoading(true);
    try {
      const b = await setBudget(yearMonth, amount);
      setCurrentBudget(b.amount);
      setBudgetSuccess(true);
      setTimeout(() => { setBudgetSuccess(false); setBudgetOpen(false); setBudgetInput(''); }, 1500);
    } catch {
      setBudgetError('저장에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setBudgetLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 카테고리 추가
  // ─────────────────────────────────────────────────────────────
  const handleCatAdd = async () => {
    const name = newCatName.trim();
    if (!name) { setCatError('카테고리 이름을 입력해 주세요'); return; }
    // 중복 이름 검사
    if (categories.some(c => c.name === name)) { setCatError('이미 존재하는 카테고리입니다'); return; }

    setCatAddLoad(true);
    setCatError('');
    try {
      const cat = await addCategory(catTab, name);
      setCategories(prev => [...prev, cat]);
      setNewCatName('');
    } catch {
      setCatError('추가에 실패했습니다');
    } finally {
      setCatAddLoad(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 카테고리 삭제
  // ─────────────────────────────────────────────────────────────
  const handleCatDelete = async (id: string) => {
    try {
      await deleteCategory(id);
      setCategories(prev => prev.filter(c => c.id !== id));
    } catch {
      setCatError('삭제에 실패했습니다');
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 카테고리 관리 화면
  // ─────────────────────────────────────────────────────────────
  if (view === 'categories') {
    return (
      <div className="flex flex-col min-h-full">

        {/* 헤더 */}
        <div
          className="flex items-center gap-2 px-4 py-4 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <button
            onClick={() => setView('main')}
            className="text-sm font-medium"
            style={{ color: 'var(--accent)' }}
          >
            ← 더보기
          </button>
          <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
            카테고리 관리
          </h2>
        </div>

        {/* 지출/수입 탭 */}
        <div className="flex border-b" style={{ borderColor: 'var(--border)' }}>
          {(['expense', 'income'] as CategoryTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => { setCatTab(tab); setCatError(''); setNewCatName(''); }}
              className="flex-1 py-3 text-sm font-semibold"
              style={{
                color: catTab === tab
                  ? (tab === 'expense' ? 'var(--expense)' : 'var(--income)')
                  : 'var(--text-secondary)',
                borderBottom: catTab === tab
                  ? `2px solid ${tab === 'expense' ? 'var(--expense)' : 'var(--income)'}`
                  : '2px solid transparent',
              }}
            >
              {tab === 'expense' ? '지출' : '수입'}
            </button>
          ))}
        </div>

        <div className="px-4 pt-4 pb-8 flex flex-col gap-4">

          {/* 카테고리 목록 */}
          {catLoading ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--text-secondary)' }}>
              불러오는 중...
            </p>
          ) : (
            <div
              className="rounded-2xl overflow-hidden"
              style={{ backgroundColor: 'var(--bg-card)' }}
            >
              {categories.length === 0 ? (
                <p className="text-sm text-center py-6" style={{ color: 'var(--text-secondary)' }}>
                  카테고리가 없습니다
                </p>
              ) : (
                categories.map((cat, i) => (
                  <div key={cat.id}>
                    {i > 0 && (
                      <div
                        className="mx-4"
                        style={{ height: '1px', backgroundColor: 'var(--border)' }}
                      />
                    )}
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                        {cat.name}
                      </span>
                      <button
                        onClick={() => handleCatDelete(cat.id)}
                        className="text-xs px-3 py-1 rounded-lg border"
                        style={{
                          color: 'var(--expense)',
                          borderColor: 'var(--expense)',
                        }}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* 새 카테고리 추가 입력 */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newCatName}
              onChange={e => { setNewCatName(e.target.value); setCatError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleCatAdd()}
              placeholder="새 카테고리 이름 입력"
              className="flex-1 px-4 py-3 rounded-xl text-sm outline-none"
              style={{
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
              }}
            />
            <button
              onClick={handleCatAdd}
              disabled={catAddLoad}
              className="px-4 py-3 rounded-xl text-sm font-semibold disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
            >
              {catAddLoad ? '...' : '추가'}
            </button>
          </div>

          {catError && (
            <p className="text-sm text-center" style={{ color: 'var(--expense)' }}>
              {catError}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 메인 메뉴 화면
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-full px-4 pt-6 pb-8 gap-3">

      {/* ── 1. PIN 번호 변경 섹션 ────────────────────────────── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ backgroundColor: 'var(--bg-card)' }}
      >
        {/* 헤더 행 — 클릭 시 아코디언 토글 */}
        <button
          className="w-full flex items-center justify-between px-4 py-4"
          onClick={() => {
            setPinOpen(o => !o);
            setPinError(''); setPinSuccess(false);
          }}
        >
          <div className="flex items-center gap-3">
            <span>🔐</span>
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              PIN 번호 변경
            </span>
          </div>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {pinOpen ? '∧' : '∨'}
          </span>
        </button>

        {/* 확장 영역 */}
        {pinOpen && (
          <div
            className="px-4 pb-4 flex flex-col gap-3 border-t"
            style={{ borderColor: 'var(--border)' }}
          >
            <div className="pt-3 flex flex-col gap-2">
              {/* 현재 PIN / 새 PIN / 확인 PIN 입력 필드 */}
              {([
                { label: '현재 PIN',   value: currentPin, set: setCurrentPin },
                { label: '새 PIN',     value: newPin,     set: setNewPin },
                { label: '새 PIN 확인', value: confirmPin, set: setConfirmPin },
              ] as const).map(({ label, value, set }) => (
                <div key={label} className="flex flex-col gap-1">
                  <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {label}
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={value}
                    onChange={e => set(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="••••"
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border)',
                    }}
                  />
                </div>
              ))}
            </div>

            {pinError   && <p className="text-xs text-center" style={{ color: 'var(--expense)' }}>{pinError}</p>}
            {pinSuccess && <p className="text-xs text-center" style={{ color: 'var(--income)' }}>PIN이 변경되었습니다 ✓</p>}

            <button
              onClick={handlePinSave}
              disabled={pinLoading}
              className="w-full py-3 rounded-xl text-sm font-bold disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
            >
              {pinLoading ? '저장 중...' : '변경 저장'}
            </button>
          </div>
        )}
      </div>

      {/* ── 2. 예산 설정 섹션 ─────────────────────────────────── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ backgroundColor: 'var(--bg-card)' }}
      >
        <button
          className="w-full flex items-center justify-between px-4 py-4"
          onClick={() => {
            setBudgetOpen(o => !o);
            setBudgetError(''); setBudgetSuccess(false);
          }}
        >
          <div className="flex items-center gap-3">
            <span>💰</span>
            <div className="flex flex-col items-start">
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                예산 설정 ({getCurrentYearMonthLabel()})
              </span>
              {/* 현재 설정된 예산 금액을 서브텍스트로 표시 */}
              {currentBudget !== null && (
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  현재: ¥{currentBudget.toLocaleString('ja-JP')}
                </span>
              )}
            </div>
          </div>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {budgetOpen ? '∧' : '∨'}
          </span>
        </button>

        {budgetOpen && (
          <div
            className="px-4 pb-4 flex flex-col gap-3 border-t"
            style={{ borderColor: 'var(--border)' }}
          >
            <div className="pt-3 flex flex-col gap-1">
              <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                목표 금액 (¥)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={budgetInput}
                onChange={e => setBudgetInput(e.target.value.replace(/\D/g, ''))}
                placeholder={currentBudget !== null ? String(currentBudget) : '예: 300000'}
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                }}
              />
            </div>

            {budgetError   && <p className="text-xs text-center" style={{ color: 'var(--expense)' }}>{budgetError}</p>}
            {budgetSuccess && <p className="text-xs text-center" style={{ color: 'var(--income)' }}>저장되었습니다 ✓</p>}

            <button
              onClick={handleBudgetSave}
              disabled={budgetLoading}
              className="w-full py-3 rounded-xl text-sm font-bold disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
            >
              {budgetLoading ? '저장 중...' : '저장'}
            </button>
          </div>
        )}
      </div>

      {/* ── 3. 카테고리 관리 (카테고리 뷰로 이동) ─────────────── */}
      <button
        className="w-full flex items-center justify-between px-4 py-4 rounded-2xl"
        style={{ backgroundColor: 'var(--bg-card)' }}
        onClick={() => { setView('categories'); setCatError(''); setNewCatName(''); }}
      >
        <div className="flex items-center gap-3">
          <span>📂</span>
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            카테고리 관리
          </span>
        </div>
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>›</span>
      </button>

    </div>
  );
}
