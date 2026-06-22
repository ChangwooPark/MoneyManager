'use client';

import { useState, useEffect } from 'react';
import {
  changePin, getBudget, setBudget, getCategories, addCategory, deleteCategory,
  verifyPin, deleteAllTransactions,
  getNotificationSettings, updateNotificationSettings, sendTestNotification,
} from '@/lib/api';
import { Category } from '@/types';

// ─── 현재 연월 헬퍼 ──────────────────────────────────────────
function getCurrentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getCurrentYearMonthLabel(): string {
  const d = new Date();
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
}

// ─── 타입 정의 ───────────────────────────────────────────────
type MoreView    = 'main' | 'categories';
type CategoryTab = 'expense' | 'income';

// 아코디언에서 한 번에 하나의 섹션만 열립니다.
// null = 모두 닫힘
type OpenSection = 'pin' | 'budget' | 'notification' | 'reset' | null;

// 데이터 초기화 플로우: PIN 입력 → 최종 확인 버튼
type ResetStep = 'pin' | 'confirm';

// ─── Props ───────────────────────────────────────────────────
interface MoreTabProps {
  // 초기화 완료 시 홈/달력/통계 탭 갱신을 트리거하기 위한 콜백
  onReset?: () => void;
}

// ─── MoreTab 컴포넌트 ─────────────────────────────────────────
export default function MoreTab({ onReset }: MoreTabProps) {
  const [view, setView] = useState<MoreView>('main');

  // ── 아코디언 단일 열림 ────────────────────────────────────────
  // 하나의 string | null 값으로 관리 → 다른 섹션 열면 이전 섹션 자동 닫힘
  const [openSection, setOpenSection] = useState<OpenSection>(null);

  const toggleSection = (section: OpenSection) => {
    setOpenSection(prev => prev === section ? null : section);
  };

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
  // 데이터 초기화 상태
  // ─────────────────────────────────────────────────────────────
  const [resetPin,     setResetPin]     = useState('');
  const [resetStep,    setResetStep]    = useState<ResetStep>('pin');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError,   setResetError]   = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  // ─────────────────────────────────────────────────────────────
  // LINE 알림 설정 상태
  // ─────────────────────────────────────────────────────────────
  const [notifEnabled,  setNotifEnabled]  = useState(true);
  const [notifLoading,  setNotifLoading]  = useState(false);
  const [testSending,   setTestSending]   = useState(false);
  const [testResult,    setTestResult]    = useState<'sent' | 'error' | null>(null);

  // ─────────────────────────────────────────────────────────────
  // 카테고리 관리 상태
  // ─────────────────────────────────────────────────────────────
  const [catTab,     setCatTab]     = useState<CategoryTab>('expense');
  const [categories, setCategories] = useState<Category[]>([]);
  const [catLoading, setCatLoading] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [catAddLoad, setCatAddLoad] = useState(false);
  const [catError,   setCatError]   = useState('');

  // ── 섹션 전환 시 폼 상태 초기화 ──────────────────────────────
  // 다른 섹션을 열 때 이전 섹션의 입력값·오류·성공 상태를 리셋합니다.
  useEffect(() => {
    if (openSection !== 'pin') {
      setCurrentPin(''); setNewPin(''); setConfirmPin('');
      setPinError(''); setPinSuccess(false);
    }
    if (openSection !== 'budget') {
      setBudgetInput(''); setBudgetError(''); setBudgetSuccess(false);
    }
    if (openSection !== 'notification') {
      setTestResult(null);
    }
    if (openSection !== 'reset') {
      setResetPin(''); setResetStep('pin');
      setResetError(''); setResetSuccess(false);
    }
  }, [openSection]);

  // ── 현재 월 예산 조회 ─────────────────────────────────────────
  useEffect(() => {
    getBudget(yearMonth)
      .then(b => setCurrentBudget(b.amount))
      .catch(() => setCurrentBudget(null));
  }, [yearMonth]);

  // ── LINE 알림 설정 조회 (마운트 시 1회) ───────────────────────
  useEffect(() => {
    getNotificationSettings()
      .then(s => setNotifEnabled(s.enabled))
      .catch(() => {}); // 오류 시 기본값(true) 유지
  }, []);

  // ── 카테고리 목록 조회 ────────────────────────────────────────
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
        setTimeout(() => { setPinSuccess(false); setOpenSection(null); }, 1500);
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
      setTimeout(() => { setBudgetSuccess(false); setOpenSection(null); setBudgetInput(''); }, 1500);
    } catch {
      setBudgetError('저장에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setBudgetLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 데이터 초기화 — Step 1: PIN 검증
  // ─────────────────────────────────────────────────────────────
  const handleResetVerifyPin = async () => {
    setResetError('');
    if (!/^\d{4}$/.test(resetPin)) { setResetError('PIN 4자리를 입력해 주세요'); return; }

    setResetLoading(true);
    try {
      const res = await verifyPin(resetPin);
      if (res.success) {
        setResetStep('confirm'); // PIN 검증 성공 → 최종 확인 단계로
      } else {
        setResetError('PIN이 올바르지 않습니다');
      }
    } catch {
      setResetError('확인에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setResetLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 데이터 초기화 — Step 2: 전체 삭제 실행
  // ─────────────────────────────────────────────────────────────
  const handleResetConfirm = async () => {
    setResetLoading(true);
    setResetError('');
    try {
      await deleteAllTransactions();
      setResetSuccess(true);
      onReset?.(); // 홈·달력·통계 탭 데이터 갱신
      setTimeout(() => {
        setResetSuccess(false);
        setOpenSection(null);
      }, 2000);
    } catch {
      setResetError('초기화에 실패했습니다. 다시 시도해 주세요.');
      setResetStep('pin'); // 오류 시 PIN 입력 단계로 복귀
    } finally {
      setResetLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // LINE 알림 ON/OFF 토글
  // ─────────────────────────────────────────────────────────────
  const handleNotifToggle = async () => {
    setNotifLoading(true);
    try {
      const res = await updateNotificationSettings(!notifEnabled);
      setNotifEnabled(res.enabled);
    } catch {
      // 오류 시 현재 상태 유지
    } finally {
      setNotifLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // LINE 테스트 메시지 발송
  // ─────────────────────────────────────────────────────────────
  const handleTestSend = async () => {
    setTestSending(true);
    setTestResult(null);
    try {
      await sendTestNotification();
      setTestResult('sent');
    } catch {
      setTestResult('error');
    } finally {
      setTestSending(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 카테고리 추가 / 삭제
  // ─────────────────────────────────────────────────────────────
  const handleCatAdd = async () => {
    const name = newCatName.trim();
    if (!name) { setCatError('카테고리 이름을 입력해 주세요'); return; }
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
          {catLoading ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--text-secondary)' }}>
              불러오는 중...
            </p>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--bg-card)' }}>
              {categories.length === 0 ? (
                <p className="text-sm text-center py-6" style={{ color: 'var(--text-secondary)' }}>
                  카테고리가 없습니다
                </p>
              ) : (
                categories.map((cat, i) => (
                  <div key={cat.id}>
                    {i > 0 && (
                      <div className="mx-4" style={{ height: '1px', backgroundColor: 'var(--border)' }} />
                    )}
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{cat.name}</span>
                      <button
                        onClick={() => handleCatDelete(cat.id)}
                        className="text-xs px-3 py-1 rounded-lg border"
                        style={{ color: 'var(--expense)', borderColor: 'var(--expense)' }}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

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
            <p className="text-sm text-center" style={{ color: 'var(--expense)' }}>{catError}</p>
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

      {/* ── 1. PIN 번호 변경 ─────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--bg-card)' }}>
        <button
          className="w-full flex items-center justify-between px-4 py-4"
          onClick={() => toggleSection('pin')}
        >
          <div className="flex items-center gap-3">
            <span>🔐</span>
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              PIN 번호 변경
            </span>
          </div>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {openSection === 'pin' ? '∧' : '∨'}
          </span>
        </button>

        {openSection === 'pin' && (
          <div className="px-4 pb-4 flex flex-col gap-3 border-t" style={{ borderColor: 'var(--border)' }}>
            <div className="pt-3 flex flex-col gap-2">
              {([
                { label: '현재 PIN',    value: currentPin, set: setCurrentPin },
                { label: '새 PIN',      value: newPin,     set: setNewPin },
                { label: '새 PIN 확인', value: confirmPin, set: setConfirmPin },
              ] as const).map(({ label, value, set }) => (
                <div key={label} className="flex flex-col gap-1">
                  <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</label>
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

      {/* ── 2. 예산 설정 ─────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--bg-card)' }}>
        <button
          className="w-full flex items-center justify-between px-4 py-4"
          onClick={() => toggleSection('budget')}
        >
          <div className="flex items-center gap-3">
            <span>💰</span>
            <div className="flex flex-col items-start">
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                예산 설정 ({getCurrentYearMonthLabel()})
              </span>
              {currentBudget !== null && (
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  현재: ¥{currentBudget.toLocaleString('ja-JP')}
                </span>
              )}
            </div>
          </div>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {openSection === 'budget' ? '∧' : '∨'}
          </span>
        </button>

        {openSection === 'budget' && (
          <div className="px-4 pb-4 flex flex-col gap-3 border-t" style={{ borderColor: 'var(--border)' }}>
            <div className="pt-3 flex flex-col gap-1">
              <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>목표 금액 (¥)</label>
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

      {/* ── 3. 카테고리 관리 (별도 화면으로 이동) ───────────── */}
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

      {/* ── 4. LINE 알림 ─────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--bg-card)' }}>
        <button
          className="w-full flex items-center justify-between px-4 py-4"
          onClick={() => toggleSection('notification')}
        >
          <div className="flex items-center gap-3">
            <span>🔔</span>
            <div className="flex flex-col items-start">
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                LINE 알림
              </span>
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {notifEnabled ? '켜짐' : '꺼짐'}
              </span>
            </div>
          </div>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {openSection === 'notification' ? '∧' : '∨'}
          </span>
        </button>

        {openSection === 'notification' && (
          <div className="px-4 pb-4 flex flex-col gap-3 border-t" style={{ borderColor: 'var(--border)' }}>

            {/* ON/OFF 토글 행 */}
            <div className="pt-3 flex items-center justify-between">
              <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                거래 등록 시 LINE 알림
              </span>
              <button
                onClick={handleNotifToggle}
                disabled={notifLoading}
                className="relative w-12 h-6 rounded-full transition-colors duration-200 disabled:opacity-50"
                style={{ backgroundColor: notifEnabled ? 'var(--accent)' : 'var(--border)' }}
                aria-label={notifEnabled ? '알림 끄기' : '알림 켜기'}
              >
                <span
                  className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
                  style={{ transform: notifEnabled ? 'translateX(26px)' : 'translateX(2px)' }}
                />
              </button>
            </div>

            {/* 테스트 발송 버튼 */}
            <button
              onClick={handleTestSend}
              disabled={testSending || !notifEnabled}
              className="w-full py-3 rounded-xl text-sm font-bold disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
            >
              {testSending ? '발송 중...' : '테스트 메시지 발송'}
            </button>

            {testResult === 'sent'  && (
              <p className="text-xs text-center" style={{ color: 'var(--income)' }}>발송되었습니다 ✓</p>
            )}
            {testResult === 'error' && (
              <p className="text-xs text-center" style={{ color: 'var(--expense)' }}>발송에 실패했습니다</p>
            )}
          </div>
        )}
      </div>

      {/* ── 5. 데이터 초기화 ─────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--bg-card)' }}>
        <button
          className="w-full flex items-center justify-between px-4 py-4"
          onClick={() => toggleSection('reset')}
        >
          <div className="flex items-center gap-3">
            <span>🗑️</span>
            <span className="text-sm font-medium" style={{ color: 'var(--expense)' }}>
              데이터 초기화
            </span>
          </div>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {openSection === 'reset' ? '∧' : '∨'}
          </span>
        </button>

        {openSection === 'reset' && (
          <div className="px-4 pb-4 flex flex-col gap-3 border-t" style={{ borderColor: 'var(--border)' }}>

            {resetSuccess ? (
              /* 초기화 완료 메시지 */
              <p className="text-sm text-center py-4" style={{ color: 'var(--income)' }}>
                초기화가 완료되었습니다 ✓
              </p>

            ) : resetStep === 'pin' ? (
              /* Step 1: PIN 입력 */
              <>
                <p className="text-xs pt-3" style={{ color: 'var(--text-secondary)' }}>
                  모든 거래 내역이 삭제됩니다. 계속하려면 PIN을 입력해 주세요.
                </p>
                <div className="flex flex-col gap-1">
                  <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>PIN</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={resetPin}
                    onChange={e => { setResetPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setResetError(''); }}
                    placeholder="••••"
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border)',
                    }}
                  />
                </div>

                {resetError && (
                  <p className="text-xs text-center" style={{ color: 'var(--expense)' }}>{resetError}</p>
                )}

                <button
                  onClick={handleResetVerifyPin}
                  disabled={resetLoading}
                  className="w-full py-3 rounded-xl text-sm font-bold disabled:opacity-50"
                  style={{ backgroundColor: 'var(--expense)', color: '#fff' }}
                >
                  {resetLoading ? '확인 중...' : '확인'}
                </button>
              </>

            ) : (
              /* Step 2: 최종 확인 */
              <>
                <p className="text-sm pt-3 text-center font-semibold" style={{ color: 'var(--expense)' }}>
                  ⚠️ 모든 거래 내역이 영구 삭제됩니다
                </p>
                <p className="text-xs text-center" style={{ color: 'var(--text-secondary)' }}>
                  이 작업은 되돌릴 수 없습니다.
                </p>

                {resetError && (
                  <p className="text-xs text-center" style={{ color: 'var(--expense)' }}>{resetError}</p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => { setResetStep('pin'); setResetPin(''); setResetError(''); }}
                    className="flex-1 py-3 rounded-xl text-sm font-bold border"
                    style={{
                      color: 'var(--text-secondary)',
                      borderColor: 'var(--border)',
                      backgroundColor: 'transparent',
                    }}
                  >
                    취소
                  </button>
                  <button
                    onClick={handleResetConfirm}
                    disabled={resetLoading}
                    className="flex-1 py-3 rounded-xl text-sm font-bold disabled:opacity-50"
                    style={{ backgroundColor: 'var(--expense)', color: '#fff' }}
                  >
                    {resetLoading ? '삭제 중...' : '초기화'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
