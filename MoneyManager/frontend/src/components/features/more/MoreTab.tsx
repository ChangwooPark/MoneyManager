'use client';

import { useState, useEffect } from 'react';
import {
  changePin, getBudget, setBudget, getCategories, addCategory, deleteCategory,
  verifyPin, deleteAllTransactions,
  getNotificationSettings, updateNotificationSettings, sendTestNotification,
  getLineUsers, deleteLineUser,
} from '@/lib/api';
import { Category } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { Lang } from '@/i18n/translations';

// ─── 현재 연월 헬퍼 ──────────────────────────────────────────
function getCurrentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ─── 타입 정의 ───────────────────────────────────────────────
type MoreView    = 'main' | 'categories';
type CategoryTab = 'expense' | 'income';

// 아코디언에서 한 번에 하나의 섹션만 열립니다.
// null = 모두 닫힘
type OpenSection = 'pin' | 'budget' | 'language' | 'notification' | 'reset' | null;

// 데이터 초기화 플로우: PIN 입력 → 최종 확인 버튼
type ResetStep = 'pin' | 'confirm';

// ─── Props ───────────────────────────────────────────────────
interface MoreTabProps {
  // 초기화 완료 시 홈/달력/통계 탭 갱신을 트리거하기 위한 콜백
  onReset?: () => void;
}

// ─── MoreTab 컴포넌트 ─────────────────────────────────────────
export default function MoreTab({ onReset }: MoreTabProps) {
  const { t, language, setLanguage, formatYearMonth } = useLanguage();
  const [view, setView] = useState<MoreView>('main');

  // ── 아코디언 단일 열림 ────────────────────────────────────────
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
  const [lineUsers,     setLineUsers]     = useState<{ id: string; display: string }[]>([]);
  const [usersLoading,  setUsersLoading]  = useState(false);

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

  // ── LINE 알림 설정 + 수신자 목록 조회 (마운트 시 1회) ─────────
  useEffect(() => {
    getNotificationSettings()
      .then(s => setNotifEnabled(s.enabled))
      .catch(() => {});
    getLineUsers()
      .then(r => setLineUsers(r.users))
      .catch(() => {});
  }, []);

  // ── 카테고리 목록 조회 ────────────────────────────────────────
  useEffect(() => {
    if (view !== 'categories') return;
    let cancelled = false;
    setCatLoading(true);
    setCatError('');
    getCategories(catTab)
      .then(list => { if (!cancelled) setCategories(list); })
      .catch(() => { if (!cancelled) setCatError(t('loadError')); })
      .finally(() => { if (!cancelled) setCatLoading(false); });
    return () => { cancelled = true; };
  }, [view, catTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─────────────────────────────────────────────────────────────
  // PIN 변경 저장
  // ─────────────────────────────────────────────────────────────
  const handlePinSave = async () => {
    setPinError('');
    setPinSuccess(false);
    if (!/^\d{4}$/.test(currentPin)) { setPinError(t('morePinErrCurrent')); return; }
    if (!/^\d{4}$/.test(newPin))     { setPinError(t('morePinErrNew')); return; }
    if (newPin !== confirmPin)        { setPinError(t('morePinErrMatch')); return; }

    setPinLoading(true);
    try {
      const res = await changePin(currentPin, newPin);
      if (res.success) {
        setPinSuccess(true);
        setCurrentPin(''); setNewPin(''); setConfirmPin('');
        setTimeout(() => { setPinSuccess(false); setOpenSection(null); }, 1500);
      } else {
        setPinError(t('morePinErrWrong'));
      }
    } catch {
      setPinError(t('morePinErrSave'));
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
      setBudgetError(t('moreBudgetErrAmt'));
      return;
    }

    setBudgetLoading(true);
    try {
      const b = await setBudget(yearMonth, amount);
      setCurrentBudget(b.amount);
      setBudgetSuccess(true);
      setTimeout(() => { setBudgetSuccess(false); setOpenSection(null); setBudgetInput(''); }, 1500);
    } catch {
      setBudgetError(t('moreBudgetErrSave'));
    } finally {
      setBudgetLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 데이터 초기화 — Step 1: PIN 검증
  // ─────────────────────────────────────────────────────────────
  const handleResetVerifyPin = async () => {
    setResetError('');
    if (!/^\d{4}$/.test(resetPin)) { setResetError(t('moreResetErrPin')); return; }

    setResetLoading(true);
    try {
      const res = await verifyPin(resetPin);
      if (res.success) {
        setResetStep('confirm');
      } else {
        setResetError(t('moreResetErrWrong'));
      }
    } catch {
      setResetError(t('moreResetErrFail'));
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
      onReset?.();
      setTimeout(() => {
        setResetSuccess(false);
        setOpenSection(null);
      }, 2000);
    } catch {
      setResetError(t('moreResetErrExec'));
      setResetStep('pin');
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
  // LINE 수신자 삭제
  // ─────────────────────────────────────────────────────────────
  const handleDeleteLineUser = async (id: string) => {
    setUsersLoading(true);
    try {
      await deleteLineUser(id);
      setLineUsers(prev => prev.filter(u => u.id !== id));
    } catch {
      // 오류 시 현재 상태 유지
    } finally {
      setUsersLoading(false);
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
    if (!name) { setCatError(t('moreCatErrName')); return; }
    if (categories.some(c => c.name === name)) { setCatError(t('moreCatErrDup')); return; }

    setCatAddLoad(true);
    setCatError('');
    try {
      const cat = await addCategory(catTab, name);
      setCategories(prev => [...prev, cat]);
      setNewCatName('');
    } catch {
      setCatError(t('moreCatErrAdd'));
    } finally {
      setCatAddLoad(false);
    }
  };

  const handleCatDelete = async (id: string) => {
    try {
      await deleteCategory(id);
      setCategories(prev => prev.filter(c => c.id !== id));
    } catch {
      setCatError(t('moreCatErrDelete'));
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
            {t('moreCatBack')}
          </button>
          <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
            {t('moreCat')}
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
              {tab === 'expense' ? t('expense') : t('income')}
            </button>
          ))}
        </div>

        <div className="px-4 pt-4 pb-8 flex flex-col gap-4">
          {catLoading ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--text-secondary)' }}>
              {t('loading')}
            </p>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--bg-card)' }}>
              {categories.length === 0 ? (
                <p className="text-sm text-center py-6" style={{ color: 'var(--text-secondary)' }}>
                  {t('moreCatNone')}
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
                        {t('moreCatDelete')}
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
              placeholder={t('moreCatPlaceholder')}
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
              {catAddLoad ? '...' : t('moreCatAdd')}
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
  // 현재 연월 레이블 (언어에 따라 포맷 변경)
  // ─────────────────────────────────────────────────────────────
  const [ym_year, ym_month] = yearMonth.split('-');
  const yearMonthLabel = formatYearMonth(ym_year, ym_month);

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
              {t('morePin')}
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
                { label: t('morePinCurrent'), value: currentPin, set: setCurrentPin },
                { label: t('morePinNew'),     value: newPin,     set: setNewPin },
                { label: t('morePinConfirm'), value: confirmPin, set: setConfirmPin },
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
            {pinSuccess && <p className="text-xs text-center" style={{ color: 'var(--income)' }}>{t('morePinSuccess')}</p>}

            <button
              onClick={handlePinSave}
              disabled={pinLoading}
              className="w-full py-3 rounded-xl text-sm font-bold disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
            >
              {pinLoading ? t('formSaving') : t('morePinSave')}
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
                {t('moreBudget')} ({yearMonthLabel})
              </span>
              {currentBudget !== null && (
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {t('moreCurrent')}: ¥{currentBudget.toLocaleString('ja-JP')}
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
              <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('moreBudgetTarget')}</label>
              <input
                type="text"
                inputMode="numeric"
                value={budgetInput}
                onChange={e => setBudgetInput(e.target.value.replace(/\D/g, ''))}
                placeholder={currentBudget !== null ? String(currentBudget) : '300000'}
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                }}
              />
            </div>

            {budgetError   && <p className="text-xs text-center" style={{ color: 'var(--expense)' }}>{budgetError}</p>}
            {budgetSuccess && <p className="text-xs text-center" style={{ color: 'var(--income)' }}>{t('moreBudgetSuccess')}</p>}

            <button
              onClick={handleBudgetSave}
              disabled={budgetLoading}
              className="w-full py-3 rounded-xl text-sm font-bold disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
            >
              {budgetLoading ? t('formSaving') : t('moreBudgetSave')}
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
            {t('moreCat')}
          </span>
        </div>
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>›</span>
      </button>

      {/* ── 4. 언어 설정 ─────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--bg-card)' }}>
        <button
          className="w-full flex items-center justify-between px-4 py-4"
          onClick={() => toggleSection('language')}
        >
          <div className="flex items-center gap-3">
            <span>🌐</span>
            <div className="flex flex-col items-start">
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {t('moreLang')}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {language === 'ko' ? t('moreLangKo') : t('moreLangJa')}
              </span>
            </div>
          </div>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {openSection === 'language' ? '∧' : '∨'}
          </span>
        </button>

        {openSection === 'language' && (
          <div className="px-4 pb-4 flex gap-2 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
            {(['ko', 'ja'] as Lang[]).map(lang => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                className="flex-1 py-3 rounded-xl text-sm font-bold border transition-all"
                style={{
                  backgroundColor: language === lang ? 'var(--accent)' : 'transparent',
                  color: language === lang ? '#fff' : 'var(--text-secondary)',
                  borderColor: language === lang ? 'var(--accent)' : 'var(--border)',
                }}
              >
                {lang === 'ko' ? `🇰🇷 ${t('moreLangKo')}` : `🇯🇵 ${t('moreLangJa')}`}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── 5. LINE 알림 ─────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--bg-card)' }}>
        <button
          className="w-full flex items-center justify-between px-4 py-4"
          onClick={() => toggleSection('notification')}
        >
          <div className="flex items-center gap-3">
            <span>🔔</span>
            <div className="flex flex-col items-start">
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {t('moreLine')}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {notifEnabled ? t('moreLineOn') : t('moreLineOff')}
              </span>
            </div>
          </div>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {openSection === 'notification' ? '∧' : '∨'}
          </span>
        </button>

        {openSection === 'notification' && (
          <div className="px-4 pb-4 flex flex-col gap-3 border-t" style={{ borderColor: 'var(--border)' }}>

            {/* 수신자 목록 */}
            <div className="pt-3 flex flex-col gap-1">
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {t('moreLineRecipients')} ({lineUsers.length}{t('statsCountUnit')})
              </p>
              {lineUsers.length === 0 ? (
                <p className="text-xs py-2" style={{ color: 'var(--text-secondary)' }}>
                  {t('moreLineNone')}
                </p>
              ) : (
                lineUsers.map(user => (
                  <div key={user.id} className="flex items-center justify-between py-1">
                    <span className="text-xs font-mono" style={{ color: 'var(--text-primary)' }}>
                      {user.display}
                    </span>
                    <button
                      onClick={() => handleDeleteLineUser(user.id)}
                      disabled={usersLoading}
                      className="text-xs px-2 py-0.5 rounded border disabled:opacity-50"
                      style={{ color: 'var(--expense)', borderColor: 'var(--expense)' }}
                    >
                      {t('moreLineDelete')}
                    </button>
                  </div>
                ))
              )}
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                {t('moreLineAddHint')}
              </p>
            </div>

            {/* ON/OFF 토글 행 */}
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                {t('moreLineTxNotif')}
              </span>
              <button
                onClick={handleNotifToggle}
                disabled={notifLoading}
                className="relative shrink-0 w-12 h-6 p-0 rounded-full transition-colors duration-200 disabled:opacity-50"
                style={{ backgroundColor: notifEnabled ? 'var(--accent)' : 'var(--border)' }}
                aria-label={notifEnabled ? t('moreLineToggleOn') : t('moreLineToggleOff')}
              >
                {/* p-0 필수 — <button> 기본 padding이 absolute 기준점에 영향을 줌 */}
                {/* left-0.5(2px) 명시 + ON 시 translateX(24px) → 우측 끝 2+20+24=46px (48px 이내) */}
                <span
                  className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200"
                  style={{ transform: notifEnabled ? 'translateX(24px)' : 'translateX(0)' }}
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
              {testSending ? t('moreLineTesting') : t('moreLineTest')}
            </button>

            {testResult === 'sent'  && (
              <p className="text-xs text-center" style={{ color: 'var(--income)' }}>{t('moreLineTestSent')}</p>
            )}
            {testResult === 'error' && (
              <p className="text-xs text-center" style={{ color: 'var(--expense)' }}>{t('moreLineTestError')}</p>
            )}
          </div>
        )}
      </div>

      {/* ── 6. 데이터 초기화 ─────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--bg-card)' }}>
        <button
          className="w-full flex items-center justify-between px-4 py-4"
          onClick={() => toggleSection('reset')}
        >
          <div className="flex items-center gap-3">
            <span>🗑️</span>
            <span className="text-sm font-medium" style={{ color: 'var(--expense)' }}>
              {t('moreReset')}
            </span>
          </div>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {openSection === 'reset' ? '∧' : '∨'}
          </span>
        </button>

        {openSection === 'reset' && (
          <div className="px-4 pb-4 flex flex-col gap-3 border-t" style={{ borderColor: 'var(--border)' }}>

            {resetSuccess ? (
              <p className="text-sm text-center py-4" style={{ color: 'var(--income)' }}>
                {t('moreResetDone')}
              </p>

            ) : resetStep === 'pin' ? (
              <>
                <p className="text-xs pt-3" style={{ color: 'var(--text-secondary)' }}>
                  {t('moreResetWarning')}
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
                  {resetLoading ? t('moreResetChecking') : t('moreResetCheck')}
                </button>
              </>

            ) : (
              <>
                <p className="text-sm pt-3 text-center font-semibold" style={{ color: 'var(--expense)' }}>
                  {t('moreResetFinalW')}
                </p>
                <p className="text-xs text-center" style={{ color: 'var(--text-secondary)' }}>
                  {t('moreResetFinalS')}
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
                    {t('moreResetCancel')}
                  </button>
                  <button
                    onClick={handleResetConfirm}
                    disabled={resetLoading}
                    className="flex-1 py-3 rounded-xl text-sm font-bold disabled:opacity-50"
                    style={{ backgroundColor: 'var(--expense)', color: '#fff' }}
                  >
                    {resetLoading ? t('moreResetExecing') : t('moreResetExec')}
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
