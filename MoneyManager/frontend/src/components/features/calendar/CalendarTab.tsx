'use client';

import { useState, useEffect } from 'react';
import { getTransactions } from '@/lib/api';
import { Transaction } from '@/types';

// ─── Props 타입 정의 ───────────────────────────────────────────
interface CalendarTabProps {
  yearMonth: string;  // 상단 연월 선택기에서 전달받은 현재 연월 (예: "2026-06")
  refreshKey: number; // 거래 저장 완료 시 증가 → 달력 데이터도 자동 갱신
}

// ─── 날짜별 거래 요약 타입 ─────────────────────────────────────
// 달력 셀에 수입/지출 합계와 거래 목록을 함께 보유합니다.
interface DaySummary {
  totalIncome: number;         // 해당 날짜 총 수입
  totalExpense: number;        // 해당 날짜 총 지출
  transactions: Transaction[]; // 해당 날짜 거래 목록 (바텀시트에 표시)
}

// ─── 달력 셀 타입 ──────────────────────────────────────────────
// 이전/다음 달 빈 공간은 day=null 로 구분합니다.
interface CalendarCell {
  day: number | null;     // null이면 빈 셀 (달의 시작 전/끝 후)
  dateStr: string | null; // YYYY-MM-DD, 빈 셀이면 null
  isToday: boolean;       // 오늘 날짜 여부 (하이라이트용)
}

// ─── 달력 셀 배열 생성 함수 ────────────────────────────────────
// yearMonth("2026-06")와 오늘 날짜 문자열을 받아
// 7열 그리드에 맞는 CalendarCell[] 를 반환합니다.
//
// 동작 예시 (2026-06):
//   6/1 = 월요일(getDay()=1) → 앞에 빈 셀 1개 (일요일 자리)
//   6/30 = 화요일(getDay()=2) → 뒤에 빈 셀 4개 (수~토 자리)
function buildCalendarCells(yearMonth: string, today: string): CalendarCell[] {
  const [y, m] = yearMonth.split('-').map(Number);

  // 해당 달 첫 날 요일 (0=일, 1=월, ..., 6=토)
  const firstDayOfWeek = new Date(y, m - 1, 1).getDay();

  // 해당 달 마지막 날짜 (다음 달 0일 = 이번 달 마지막 날)
  const daysInMonth = new Date(y, m, 0).getDate();

  const cells: CalendarCell[] = [];

  // 1일 이전 빈 셀 채우기
  for (let i = 0; i < firstDayOfWeek; i++) {
    cells.push({ day: null, dateStr: null, isToday: false });
  }

  // 해당 달 날짜 셀 추가
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${yearMonth}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, dateStr, isToday: dateStr === today });
  }

  // 마지막 주 나머지 자리를 빈 셀로 채워 7의 배수로 맞춤
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
// 예) 250000 → "25万"  /  1500 → "1.5千"  /  800 → "¥800"
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
// "2026-06-18" → "6월 18일 (수)"
function formatDateHeader(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const dayName = dayNames[new Date(y, m - 1, d).getDay()];
  return `${m}월 ${d}일 (${dayName})`;
}

// ─── 오늘 날짜 문자열 반환 ─────────────────────────────────────
// "YYYY-MM-DD" 형식으로 반환합니다.
function getTodayStr(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

// ─── 요일 헤더 레이블 ─────────────────────────────────────────
const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

// ─── CalendarTab 컴포넌트 ─────────────────────────────────────
// 달력 탭 화면입니다.
// 해당 월의 거래 내역을 불러와 날짜 그리드로 표시하고,
// 날짜를 클릭하면 바텀시트로 해당 날짜의 상세 내역을 보여줍니다.
export default function CalendarTab({ yearMonth, refreshKey }: CalendarTabProps) {
  // 해당 월 전체 거래 목록
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 클릭한 날짜 → 바텀시트 표시 제어 (null이면 닫힘)
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const today = getTodayStr();

  // ── 데이터 조회 ────────────────────────────────────────────
  // yearMonth 또는 refreshKey 변경 시 해당 월 거래 내역을 다시 불러옵니다.
  // cancelled 플래그: 비동기 결과가 도착하기 전에 언마운트/재실행되면
  //   setState를 호출하지 않도록 방지합니다.
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
  // { "2026-06-18": { totalIncome, totalExpense, transactions } }
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

  // ── 달력 셀 배열 ─────────────────────────────────────────
  const cells = buildCalendarCells(yearMonth, today);

  // ── 선택된 날짜의 거래 목록 (바텀시트 내용) ───────────────
  // 등록일 내림차순 정렬 (최근 등록 순)
  const selectedTransactions = selectedDate
    ? (summaryMap.get(selectedDate)?.transactions ?? [])
        .slice()
        .sort((a, b) => (b.createdAt?._seconds ?? 0) - (a.createdAt?._seconds ?? 0))
    : [];

  return (
    <div className="relative flex flex-col min-h-full">

      {/* ── 로딩 상태 ───────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center h-48">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>불러오는 중...</p>
        </div>
      )}

      {/* ── 오류 상태 ───────────────────────────────────────── */}
      {!loading && error && (
        <div className="flex items-center justify-center h-48">
          <p className="text-sm" style={{ color: 'var(--expense)' }}>{error}</p>
        </div>
      )}

      {/* ── 달력 본문 ───────────────────────────────────────── */}
      {!loading && !error && (
        <div className="px-2 pt-3 pb-6">

          {/* 요일 헤더 행 */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_LABELS.map((label, i) => (
              <div
                key={label}
                className="text-center text-xs py-1 font-semibold"
                style={{
                  // 일요일: 빨강, 토요일: 파랑, 평일: 보조 텍스트색
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

          {/* 날짜 그리드 */}
          <div className="grid grid-cols-7 gap-y-1">
            {cells.map((cell, idx) => {

              // 빈 셀 (이전/다음 달 자리)
              if (cell.day === null || cell.dateStr === null) {
                return <div key={`empty-${idx}`} className="min-h-[58px]" />;
              }

              const summary = summaryMap.get(cell.dateStr);
              const isSelected = selectedDate === cell.dateStr;

              // 열 인덱스로 일(0)/토(6) 판별
              const colIndex = idx % 7;
              const isSunday = colIndex === 0;
              const isSaturday = colIndex === 6;

              return (
                <button
                  key={cell.dateStr}
                  data-date={cell.dateStr}  /* 테스트에서 날짜로 셀을 특정하기 위한 속성 */
                  onClick={() => setSelectedDate(isSelected ? null : cell.dateStr)}
                  className="flex flex-col items-center py-1 px-0.5 rounded-xl active:opacity-70 transition-opacity min-h-[58px]"
                  style={{
                    // 선택된 날짜: 강조색 배경 / 오늘: 반투명 강조 / 나머지: 투명
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

                  {/* 수입/지출 금액 레이블 (거래가 있을 때만 표시) */}
                  {summary && (
                    <div className="flex flex-col items-center mt-0.5 gap-px">
                      {summary.totalIncome > 0 && (
                        <span
                          className="text-[9px] leading-tight font-medium"
                          style={{
                            // 선택됐을 때는 흰색, 아닐 때는 수입색(초록)
                            color: isSelected ? 'rgba(255,255,255,0.9)' : 'var(--income)',
                          }}
                        >
                          {formatYenShort(summary.totalIncome)}
                        </span>
                      )}
                      {summary.totalExpense > 0 && (
                        <span
                          className="text-[9px] leading-tight font-medium"
                          style={{
                            // 선택됐을 때는 흰색, 아닐 때는 지출색(빨강)
                            color: isSelected ? 'rgba(255,255,255,0.9)' : 'var(--expense)',
                          }}
                        >
                          -{formatYenShort(summary.totalExpense)}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 날짜 상세 바텀시트 ──────────────────────────────── */}
      {/* selectedDate 가 있을 때만 렌더링 */}
      {selectedDate && (
        <>
          {/* 반투명 오버레이 — 탭하면 바텀시트를 닫음 */}
          <div
            className="fixed inset-0 z-40"
            style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
            onClick={() => setSelectedDate(null)}
          />

          {/* 바텀시트 본체
              fixed bottom-0: 화면 하단에 고정
              max-w-sm: 모바일 폭에 맞게 제한
              max-h-[65vh]: 화면 높이의 65% 이상 차지하지 않음 */}
          <div
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl flex flex-col overflow-hidden"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              maxWidth: '28rem',
              margin: '0 auto',
              maxHeight: '65vh',
            }}
          >
            {/* 핸들 바 */}
            <div className="flex justify-center pt-3 pb-1">
              <div
                className="w-10 h-1 rounded-full"
                style={{ backgroundColor: 'var(--border)' }}
              />
            </div>

            {/* 헤더 행 — 날짜 제목 + 닫기 버튼 */}
            <div
              className="flex justify-between items-center px-4 py-2"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <span
                className="text-sm font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                {formatDateHeader(selectedDate)}
              </span>
              <button
                onClick={() => setSelectedDate(null)}
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
                /* 빈 상태 */
                <p
                  className="text-sm text-center py-8"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  이날의 거래 내역이 없습니다.
                </p>
              ) : (
                /* 거래 목록 카드 */
                <div
                  className="rounded-2xl overflow-hidden"
                  style={{ backgroundColor: 'var(--bg-card)' }}
                >
                  {selectedTransactions.map((tx, i) => (
                    <div key={tx.id ?? i}>
                      {/* 구분선 (첫 항목 제외) */}
                      {i > 0 && (
                        <div
                          className="mx-4"
                          style={{ height: '1px', backgroundColor: 'var(--border)' }}
                        />
                      )}

                      {/* 거래 행 */}
                      <div className="flex items-center justify-between px-4 py-3 gap-3">

                        {/* 왼쪽: 카테고리 칩 + 메모 */}
                        <div className="flex items-center gap-2 min-w-0">
                          {/* 카테고리 칩 */}
                          <span
                            className="shrink-0 px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{
                              backgroundColor: tx.type === 'income'
                                ? 'rgba(52,211,153,0.15)'
                                : 'rgba(248,113,113,0.15)',
                              color: tx.type === 'income'
                                ? 'var(--income)'
                                : 'var(--expense)',
                            }}
                          >
                            {tx.category}
                          </span>

                          {/* 메모 (있을 때만) */}
                          {tx.memo && (
                            <span
                              className="text-sm truncate"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              {tx.memo}
                            </span>
                          )}
                        </div>

                        {/* 오른쪽: 금액 */}
                        <span
                          className="shrink-0 text-sm font-semibold"
                          style={{
                            color: tx.type === 'income'
                              ? 'var(--income)'
                              : 'var(--expense)',
                          }}
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
