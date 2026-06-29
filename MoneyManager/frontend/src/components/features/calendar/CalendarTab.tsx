'use client';

import { Fragment, useState, useEffect, useRef } from 'react';
import { getTransactions } from '@/lib/api';
import { Transaction } from '@/types';
import TransactionDetailSheet from '../transaction/TransactionDetailSheet';
import { useLanguage } from '@/contexts/LanguageContext';
import { DAY_NAMES } from '@/i18n/translations';

// ─── Props 타입 정의 ───────────────────────────────────────────
interface CalendarTabProps {
  yearMonth: string;
  refreshKey: number;
  onEdit:    (tx: Transaction) => void;
  onRefresh: () => void;
}

// ─── 날짜별 거래 요약 타입 ─────────────────────────────────────
interface DaySummary {
  totalIncome: number;
  totalExpense: number;
  transactions: Transaction[];
}

// ─── 달력 셀 타입 ──────────────────────────────────────────────
interface CalendarCell {
  day: number | null;
  dateStr: string | null;
  isToday: boolean;
}

// ─── 달력 셀 배열 생성 함수 ────────────────────────────────────
function buildCalendarCells(yearMonth: string, today: string): CalendarCell[] {
  const [y, m] = yearMonth.split('-').map(Number);
  const firstDayOfWeek = new Date(y, m - 1, 1).getDay();
  const daysInMonth   = new Date(y, m, 0).getDate();

  const cells: CalendarCell[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    cells.push({ day: null, dateStr: null, isToday: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${yearMonth}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, dateStr, isToday: dateStr === today });
  }
  const remainder = cells.length % 7;
  if (remainder !== 0) {
    for (let i = 0; i < 7 - remainder; i++) {
      cells.push({ day: null, dateStr: null, isToday: false });
    }
  }
  return cells;
}

// ─── 금액 단축 표기 함수 ───────────────────────────────────────
function formatYenShort(amount: number): string {
  if (amount >= 10000) {
    const man = amount / 10000;
    return `${Number.isInteger(man) ? man : man.toFixed(1)}万`;
  }
  if (amount >= 1000) {
    const sen = amount / 1000;
    return `${Number.isInteger(sen) ? sen : sen.toFixed(1)}千`;
  }
  return `¥${amount}`;
}

// ─── 오늘 날짜 문자열 반환 ─────────────────────────────────────
function getTodayStr(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

// ─── 드래그 임계값 ────────────────────────────────────────────
const DISMISS_THRESHOLD = 100;

// ─── 구분선 색상 ───────────────────────────────────────────────
const DIVIDER = '1px solid var(--border)';

// ─── CalendarTab 컴포넌트 ─────────────────────────────────────
export default function CalendarTab({ yearMonth, refreshKey, onEdit, onRefresh }: CalendarTabProps) {
  const { t, language, formatDateHeader } = useLanguage();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTx, setSelectedTx]     = useState<Transaction | null>(null);

  const dragStartY    = useRef<number | null>(null);
  const [dragOffset,  setDragOffset]  = useState(0);
  const [isDragging,  setIsDragging]  = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  const today = getTodayStr();
  // 현재 언어에 맞는 요일 레이블 (ko: ['일'...'토'] / ja: ['日'...'土'])
  const dayLabels = DAY_NAMES[language];

  // ── 날짜가 바뀔 때마다 드래그 상태 초기화 ─────────────────
  useEffect(() => {
    setDragOffset(0);
    setIsDragging(false);
    dragStartY.current = null;
  }, [selectedDate]);

  // ── 시트 열린 동안 배경 스크롤 + Pull-to-Refresh 차단 ──
  useEffect(() => {
    if (!selectedDate) return;
    document.body.style.overscrollBehavior = 'none';
    const prevent = (e: TouchEvent) => {
      if (sheetRef.current?.contains(e.target as Node)) return;
      e.preventDefault();
    };
    document.addEventListener('touchmove', prevent, { passive: false });
    return () => {
      document.body.style.overscrollBehavior = '';
      document.removeEventListener('touchmove', prevent);
    };
  }, [selectedDate]);

  const closeSheet = () => setSelectedDate(null);

  const handleDragStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    setIsDragging(true);
  };
  const handleDragMove = (e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const delta = e.touches[0].clientY - dragStartY.current;
    if (delta > 0) setDragOffset(delta);
  };
  const handleDragEnd = () => {
    if (dragOffset >= DISMISS_THRESHOLD) closeSheet();
    else setDragOffset(0);
    dragStartY.current = null;
    setIsDragging(false);
  };

  // ── 데이터 조회 ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      setLoading(true);
      setError('');
      try {
        const txList = await getTransactions(yearMonth);
        if (!cancelled) setTransactions(txList);
      } catch {
        if (!cancelled) setError(t('loadError'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, [yearMonth, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 날짜별 요약 Map 생성 ──────────────────────────────────
  const summaryMap = new Map<string, DaySummary>();
  for (const tx of transactions) {
    if (!summaryMap.has(tx.date)) {
      summaryMap.set(tx.date, { totalIncome: 0, totalExpense: 0, transactions: [] });
    }
    const s = summaryMap.get(tx.date)!;
    s.transactions.push(tx);
    if (tx.type === 'income') s.totalIncome += tx.amount;
    else s.totalExpense += tx.amount;
  }

  // ── 달력 셀 배열 → 주(week) 단위로 분리 ─────────────────
  const cells = buildCalendarCells(yearMonth, today);
  const weeks: CalendarCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  const selectedTransactions = selectedDate
    ? (summaryMap.get(selectedDate)?.transactions ?? [])
        .slice()
        .sort((a, b) => (b.createdAt?._seconds ?? 0) - (a.createdAt?._seconds ?? 0))
    : [];

  return (
    <div className="relative flex-1 flex flex-col min-h-0">

      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('loading')}</p>
        </div>
      )}

      {!loading && error && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm" style={{ color: 'var(--expense)' }}>{error}</p>
        </div>
      )}

      {!loading && !error && (
        <div className="flex-1 flex flex-col px-2 pt-3 pb-2 min-h-0">

          {/* 요일 헤더 행 */}
          <div className="flex" style={{ borderBottom: DIVIDER }}>
            {dayLabels.map((label, i) => (
              <div
                key={label}
                className="flex-1 text-center text-xs py-1.5 font-semibold"
                style={{
                  borderRight: i < 6 ? DIVIDER : 'none',
                  color: i === 0
                    ? 'var(--expense)'
                    : i === 6
                    ? '#6fa8dc'
                    : 'var(--text-secondary)',
                }}
              >
                {label}
              </div>
            ))}
          </div>

          {/* 주(week) 행 목록 */}
          <div className="flex-1 flex flex-col min-h-0">
            {weeks.map((week, wi) => (
              <Fragment key={wi}>
                {wi > 0 && (
                  <div style={{ height: '1px', backgroundColor: 'var(--border)', flexShrink: 0 }} />
                )}
                <div className="flex flex-1 min-h-0">
                  {week.map((cell, ci) => {
                    const isLastCol  = ci === 6;
                    const borderRight = isLastCol ? 'none' : DIVIDER;

                    if (cell.day === null || cell.dateStr === null) {
                      return (
                        <div key={`empty-${wi}-${ci}`} className="flex-1" style={{ borderRight }} />
                      );
                    }

                    const summary    = summaryMap.get(cell.dateStr);
                    const isSelected = selectedDate === cell.dateStr;
                    const isSunday   = ci === 0;
                    const isSaturday = ci === 6;

                    return (
                      <div
                        key={cell.dateStr}
                        className="flex-1 min-w-0 overflow-hidden"
                        style={{ borderRight }}
                      >
                        <button
                          data-date={cell.dateStr}
                          onClick={() => setSelectedDate(isSelected ? null : cell.dateStr)}
                          className="w-full h-full flex flex-col items-center pt-1.5 pb-1 active:opacity-70 transition-opacity overflow-hidden"
                          style={{
                            backgroundColor: isSelected
                              ? 'var(--accent)'
                              : cell.isToday
                              ? 'rgba(99,102,241,0.18)'
                              : 'transparent',
                          }}
                        >
                          <span
                            className="text-sm font-medium leading-tight"
                            style={{
                              color: isSelected
                                ? '#ffffff'
                                : cell.isToday
                                ? 'var(--accent)'
                                : isSunday
                                ? 'var(--expense)'
                                : isSaturday
                                ? '#6fa8dc'
                                : 'var(--text-primary)',
                            }}
                          >
                            {cell.day}
                          </span>

                          {summary && (
                            <div className="flex flex-col items-center mt-0.5 gap-px w-full">
                              {summary.totalIncome > 0 && (
                                <span
                                  className="text-[9px] leading-tight font-medium w-full text-center truncate"
                                  style={{ color: isSelected ? 'rgba(255,255,255,0.9)' : 'var(--income)' }}
                                >
                                  {formatYenShort(summary.totalIncome)}
                                </span>
                              )}
                              {summary.totalExpense > 0 && (
                                <span
                                  className="text-[9px] leading-tight font-medium w-full text-center truncate"
                                  style={{ color: isSelected ? 'rgba(255,255,255,0.9)' : 'var(--expense)' }}
                                >
                                  -{formatYenShort(summary.totalExpense)}
                                </span>
                              )}
                            </div>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </Fragment>
            ))}
          </div>
        </div>
      )}

      {/* ── 날짜 상세 바텀시트 ──────────────────────────────── */}
      {selectedDate && (
        <>
          <div
            className="fixed inset-0 z-40"
            style={{ backgroundColor: `rgba(0,0,0,${Math.max(0.1, 0.45 - dragOffset / 400)})` }}
            onClick={closeSheet}
          />

          <div
            ref={sheetRef}
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl flex flex-col overflow-hidden"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              maxWidth: '28rem',
              margin: '0 auto',
              minHeight: '66vh',
              maxHeight: '65vh',
              transform: `translateY(${dragOffset}px)`,
              transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
            }}
          >
            <div
              className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing"
              onTouchStart={handleDragStart}
              onTouchMove={handleDragMove}
              onTouchEnd={handleDragEnd}
            >
              <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'var(--border)' }} />
            </div>

            <div
              className="flex justify-between items-center px-4 py-2"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {formatDateHeader(selectedDate)}
              </span>
              <button
                onClick={closeSheet}
                className="text-lg leading-none px-2 py-1"
                style={{ color: 'var(--text-secondary)' }}
                aria-label={t('close')}
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-4 py-3">
              {selectedTransactions.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: 'var(--text-secondary)' }}>
                  {t('noTxOnDay')}
                </p>
              ) : (
                <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--bg-card)' }}>
                  {selectedTransactions.map((tx, i) => (
                    <div key={tx.id ?? i}>
                      {i > 0 && (
                        <div className="mx-4" style={{ height: '1px', backgroundColor: 'var(--border)' }} />
                      )}
                      <div
                        className="flex items-center justify-between px-4 py-3 gap-3 cursor-pointer active:opacity-60 transition-opacity"
                        onClick={() => setSelectedTx(tx)}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="shrink-0 px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{
                              backgroundColor: tx.type === 'income'
                                ? 'rgba(52,211,153,0.15)'
                                : 'rgba(248,113,113,0.15)',
                              color: tx.type === 'income' ? 'var(--income)' : 'var(--expense)',
                            }}
                          >
                            {tx.category}
                          </span>
                          {tx.memo && (
                            <span className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>
                              {tx.memo}
                            </span>
                          )}
                        </div>
                        <span
                          className="shrink-0 text-sm font-semibold"
                          style={{ color: tx.type === 'income' ? 'var(--income)' : 'var(--expense)' }}
                        >
                          {tx.type === 'income' ? '+' : '-'}¥{tx.amount.toLocaleString('ja-JP')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── 거래 상세 시트 ─────────────────────────────────────── */}
      {selectedTx && (
        <TransactionDetailSheet
          transaction={selectedTx}
          onClose={() => setSelectedTx(null)}
          onEdit={onEdit}
          onDeleted={() => { setSelectedTx(null); setSelectedDate(null); onRefresh(); }}
        />
      )}
    </div>
  );
}
