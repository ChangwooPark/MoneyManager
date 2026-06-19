'use client';

import { Fragment, useState, useEffect, useRef } from 'react';
import { getTransactions } from '@/lib/api';
import { Transaction } from '@/types';

// ─── Props 타입 정의 ───────────────────────────────────────────
interface CalendarTabProps {
  yearMonth: string;  // 상단 연월 선택기에서 전달받은 현재 연월 (예: "2026-06")
  refreshKey: number; // 거래 저장 완료 시 증가 → 달력 데이터도 자동 갱신
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
// yearMonth("2026-06")와 오늘 날짜 문자열을 받아
// 7열 그리드에 맞는 CalendarCell[] 를 반환합니다.
function buildCalendarCells(yearMonth: string, today: string): CalendarCell[] {
  const [y, m] = yearMonth.split('-').map(Number);
  const firstDayOfWeek = new Date(y, m - 1, 1).getDay(); // 0=일, 6=토
  const daysInMonth   = new Date(y, m, 0).getDate();

  const cells: CalendarCell[] = [];

  // 1일 이전 빈 셀
  for (let i = 0; i < firstDayOfWeek; i++) {
    cells.push({ day: null, dateStr: null, isToday: false });
  }

  // 날짜 셀
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${yearMonth}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, dateStr, isToday: dateStr === today });
  }

  // 마지막 주 빈 셀 (7의 배수로 맞춤)
  const remainder = cells.length % 7;
  if (remainder !== 0) {
    for (let i = 0; i < 7 - remainder; i++) {
      cells.push({ day: null, dateStr: null, isToday: false });
    }
  }

  return cells;
}

// ─── 금액 단축 표기 함수 ───────────────────────────────────────
// 달력 셀 안에 표시할 때 가로 폭이 좁으므로 만/천 단위로 축약합니다.
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

// ─── 날짜 헤더 포맷 함수 ───────────────────────────────────────
function formatDateHeader(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const dayName = dayNames[new Date(y, m - 1, d).getDay()];
  return `${m}월 ${d}일 (${dayName})`;
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
// 이 픽셀 이상 아래로 드래그하면 바텀시트가 닫힘
const DISMISS_THRESHOLD = 100;

// ─── 요일 헤더 레이블 ─────────────────────────────────────────
const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

// ─── 구분선 색상 ───────────────────────────────────────────────
// 날짜 셀 사이의 수직·수평 구분선에 사용합니다.
const DIVIDER = '1px solid var(--border)';

// ─── CalendarTab 컴포넌트 ─────────────────────────────────────
// 달력 탭 화면입니다.
// - 연월 선택기와 하단 탭바를 제외한 전체 화면을 달력으로 채웁니다.
// - 주(week) 단위로 행을 나누어 각 행에 동일한 높이를 부여합니다.
// - 날짜 셀 사이에 수평·수직 구분선을 표시합니다.
export default function CalendarTab({ yearMonth, refreshKey }: CalendarTabProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');

  // 클릭한 날짜 → 바텀시트 표시 제어 (null이면 닫힘)
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // ── 바텀시트 드래그로 닫기 상태 ───────────────────────────
  const dragStartY     = useRef<number | null>(null);
  const [dragOffset,  setDragOffset]  = useState(0);
  const [isDragging,  setIsDragging]  = useState(false);

  const today = getTodayStr();

  // ── 날짜가 바뀔 때마다 드래그 상태 초기화 ─────────────────
  useEffect(() => {
    setDragOffset(0);
    setIsDragging(false);
    dragStartY.current = null;
  }, [selectedDate]);

  // ── 바텀시트 닫기 (드래그/버튼/오버레이 공통) ─────────────
  const closeSheet = () => setSelectedDate(null);

  // ── 드래그 핸들러 ─────────────────────────────────────────
  const handleDragStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleDragMove = (e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const delta = e.touches[0].clientY - dragStartY.current;
    if (delta > 0) setDragOffset(delta); // 아래 방향만 허용
  };

  const handleDragEnd = () => {
    if (dragOffset >= DISMISS_THRESHOLD) {
      closeSheet();
    } else {
      setDragOffset(0); // 스냅백
    }
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
        if (!cancelled) setError('데이터를 불러오는 데 실패했습니다.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [yearMonth, refreshKey]);

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

  // ── 선택된 날짜의 거래 목록 ───────────────────────────────
  const selectedTransactions = selectedDate
    ? (summaryMap.get(selectedDate)?.transactions ?? [])
        .slice()
        .sort((a, b) => (b.createdAt?._seconds ?? 0) - (a.createdAt?._seconds ?? 0))
    : [];

  return (
    // flex-1: main(flex flex-col) 안에서 남은 높이를 모두 채움
    // h-full 대신 flex-1 사용 — overflow-y-auto 컨테이너 내 % 높이 해석 문제를 우회
    <div className="relative flex-1 flex flex-col min-h-0">

      {/* ── 로딩 상태 ───────────────────────────────────────── */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>불러오는 중...</p>
        </div>
      )}

      {/* ── 오류 상태 ───────────────────────────────────────── */}
      {!loading && error && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm" style={{ color: 'var(--expense)' }}>{error}</p>
        </div>
      )}

      {/* ── 달력 본문 ───────────────────────────────────────── */}
      {!loading && !error && (
        // flex-1 + min-h-0: 부모(main)의 남은 높이를 모두 차지하되 넘치지 않음
        <div className="flex-1 flex flex-col px-2 pt-3 pb-2 min-h-0">

          {/* 요일 헤더 행 — flex 기반으로 날짜 열과 폭을 맞춤 */}
          <div className="flex" style={{ borderBottom: DIVIDER }}>
            {DAY_LABELS.map((label, i) => (
              <div
                key={label}
                className="flex-1 text-center text-xs py-1.5 font-semibold"
                style={{
                  // 요일 사이 수직 구분선 (마지막 열 제외)
                  borderRight: i < 6 ? DIVIDER : 'none',
                  color: i === 0
                    ? 'var(--expense)'   // 일요일: 빨강
                    : i === 6
                    ? '#6fa8dc'          // 토요일: 파랑
                    : 'var(--text-secondary)',
                }}
              >
                {label}
              </div>
            ))}
          </div>

          {/* 주(week) 행 목록 — flex-1 으로 남은 높이를 균등 분배 */}
          <div className="flex-1 flex flex-col min-h-0">
            {weeks.map((week, wi) => (
              <Fragment key={wi}>
                {/* 주 사이 수평 구분선 */}
                {wi > 0 && (
                  <div style={{ height: '1px', backgroundColor: 'var(--border)', flexShrink: 0 }} />
                )}

                {/* 한 주의 7개 날짜 셀 */}
                <div className="flex flex-1 min-h-0">
                  {week.map((cell, ci) => {
                    const isLastCol  = ci === 6;
                    const borderRight = isLastCol ? 'none' : DIVIDER;

                    // 빈 셀 (이전/다음 달 자리)
                    if (cell.day === null || cell.dateStr === null) {
                      return (
                        <div
                          key={`empty-${wi}-${ci}`}
                          className="flex-1"
                          style={{ borderRight }}
                        />
                      );
                    }

                    const summary    = summaryMap.get(cell.dateStr);
                    const isSelected = selectedDate === cell.dateStr;
                    const isSunday   = ci === 0;
                    const isSaturday = ci === 6;

                    return (
                      // 날짜 셀 래퍼 — 수직 구분선 담당
                      <div
                        key={cell.dateStr}
                        className="flex-1 min-w-0 overflow-hidden"
                        style={{ borderRight }}
                      >
                        {/* 클릭 가능한 날짜 버튼 — 부모 래퍼를 꽉 채움 */}
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
                          {/* 날짜 숫자 */}
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

                          {/* 수입/지출 금액 레이블 (거래가 있을 때만) */}
                          {summary && (
                            <div className="flex flex-col items-center mt-0.5 gap-px w-full">
                              {summary.totalIncome > 0 && (
                                <span
                                  className="text-[9px] leading-tight font-medium w-full text-center truncate"
                                  style={{
                                    color: isSelected ? 'rgba(255,255,255,0.9)' : 'var(--income)',
                                  }}
                                >
                                  {formatYenShort(summary.totalIncome)}
                                </span>
                              )}
                              {summary.totalExpense > 0 && (
                                <span
                                  className="text-[9px] leading-tight font-medium w-full text-center truncate"
                                  style={{
                                    color: isSelected ? 'rgba(255,255,255,0.9)' : 'var(--expense)',
                                  }}
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
          {/* 반투명 오버레이 — 드래그 거리에 따라 점차 투명해짐 */}
          <div
            className="fixed inset-0 z-40"
            style={{ backgroundColor: `rgba(0,0,0,${Math.max(0.1, 0.45 - dragOffset / 400)})` }}
            onClick={closeSheet}
          />

          {/* 바텀시트 본체 — 드래그 거리만큼 translateY로 내려감 */}
          <div
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl flex flex-col overflow-hidden"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              maxWidth: '28rem',
              margin: '0 auto',
              maxHeight: '65vh',
              transform: `translateY(${dragOffset}px)`,
              transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
            }}
          >
            {/* 핸들 바 — 터치 드래그로 닫기 */}
            <div
              className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing"
              onTouchStart={handleDragStart}
              onTouchMove={handleDragMove}
              onTouchEnd={handleDragEnd}
            >
              <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'var(--border)' }} />
            </div>

            {/* 헤더 — 날짜 + 닫기 버튼 */}
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
                aria-label="닫기"
              >
                ✕
              </button>
            </div>

            {/* 거래 목록 스크롤 영역 */}
            <div className="overflow-y-auto flex-1 px-4 py-3">
              {selectedTransactions.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: 'var(--text-secondary)' }}>
                  이날의 거래 내역이 없습니다.
                </p>
              ) : (
                <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--bg-card)' }}>
                  {selectedTransactions.map((tx, i) => (
                    <div key={tx.id ?? i}>
                      {i > 0 && (
                        <div className="mx-4" style={{ height: '1px', backgroundColor: 'var(--border)' }} />
                      )}
                      <div className="flex items-center justify-between px-4 py-3 gap-3">
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
    </div>
  );
}
