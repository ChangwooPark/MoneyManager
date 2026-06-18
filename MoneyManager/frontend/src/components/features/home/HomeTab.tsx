'use client';

import { useState, useEffect } from 'react';
import { getTransactions, getBudget } from '@/lib/api';
import { Transaction, Budget } from '@/types';

// ─── Props 타입 정의 ───────────────────────────────────────────
interface HomeTabProps {
  yearMonth: string;  // 상단 연월 선택기에서 전달받은 현재 연월 (예: "2026-06")
  refreshKey: number; // 거래 저장 완료 시 증가 → 목록 재조회 트리거
}

// ─── 날짜별 그룹 타입 ──────────────────────────────────────────
// 거래 목록을 날짜별로 묶어 표시할 때 사용합니다.
interface DayGroup {
  date: string;              // YYYY-MM-DD
  transactions: Transaction[];
  totalIncome: number;       // 해당 날짜 총 수입
  totalExpense: number;      // 해당 날짜 총 지출
}

// ─── 날짜 헤더 포맷 함수 ───────────────────────────────────────
// "2026-06-18" → "6월 18일 (수)"
function formatDateHeader(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${m}월 ${d}일 (${days[date.getDay()]})`;
}

// ─── 금액 엔화 포맷 함수 ───────────────────────────────────────
// 12000 → "¥12,000"
function formatYen(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`;
}

// ─── Firestore 타임스탬프 → 초 단위 숫자 ──────────────────────
// 같은 날짜 내에서 등록 순서로 정렬할 때 사용합니다.
function createdAtSeconds(tx: Transaction): number {
  return tx.createdAt?._seconds ?? 0;
}

// ─── 거래 내역을 날짜별로 그룹화하는 함수 ─────────────────────
// 정렬 기준: 날짜 DESC → 같은 날짜 내에서는 등록일 DESC (최신 등록 먼저)
function groupByDate(transactions: Transaction[]): DayGroup[] {
  const sorted = [...transactions].sort((a, b) => {
    if (b.date !== a.date) return b.date.localeCompare(a.date);
    return createdAtSeconds(b) - createdAtSeconds(a);
  });

  // Map으로 날짜별 그룹화 (삽입 순서 유지)
  const map = new Map<string, Transaction[]>();
  for (const tx of sorted) {
    if (!map.has(tx.date)) map.set(tx.date, []);
    map.get(tx.date)!.push(tx);
  }

  // DayGroup 배열로 변환
  return [...map.entries()].map(([date, txs]) => ({
    date,
    transactions: txs,
    totalIncome:  txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
    totalExpense: txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
  }));
}

// ─── HomeTab 컴포넌트 ──────────────────────────────────────────
// 홈 탭 화면입니다. 상단에 예산 대시보드, 하단에 날짜별 거래 내역 목록을 표시합니다.
export default function HomeTab({ yearMonth, refreshKey }: HomeTabProps) {

  // ── 데이터 상태 ──────────────────────────────────────────────
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budget, setBudget]             = useState<Budget | null>(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');

  // ── 데이터 조회 effect ────────────────────────────────────────
  // yearMonth 또는 refreshKey가 바뀔 때마다 재조회합니다.
  // refreshKey: 거래 저장 완료 시 MainApp에서 +1 → 목록이 즉시 갱신됨
  useEffect(() => {
    let cancelled = false; // 언마운트 또는 재조회 시 이전 응답 무시

    async function fetchData() {
      setLoading(true);
      setError('');
      try {
        // 거래 내역과 예산을 병렬로 조회하여 속도 최적화
        // 예산이 미설정된 경우 API가 404를 반환하므로 catch로 null 처리
        const [txList, budgetData] = await Promise.all([
          getTransactions(yearMonth),
          getBudget(yearMonth).catch(() => null),
        ]);
        if (!cancelled) {
          setTransactions(txList);
          setBudget(budgetData);
        }
      } catch {
        if (!cancelled) setError('데이터를 불러오는 데 실패했습니다.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [yearMonth, refreshKey]);

  // ── 집계값 계산 ───────────────────────────────────────────────
  // 당월 총 수입 / 총 지출 / 잔여 예산 계산
  const totalIncome  = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const remaining    = budget ? budget.amount - totalExpense : null;

  // 예산 대비 지출 비율 (진행 바용, 0~1 클램프)
  const budgetRatio  = budget && budget.amount > 0
    ? Math.min(1, totalExpense / budget.amount)
    : 0;

  // 날짜별 그룹화된 거래 목록
  const dayGroups = groupByDate(transactions);

  // ── 로딩 / 오류 상태 렌더링 ─────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>불러오는 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm" style={{ color: 'var(--expense)' }}>{error}</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 flex flex-col gap-4">

      {/* ── 예산 대시보드 ────────────────────────────────────────
          상단에 고정되어 당월 예산 현황을 한눈에 파악할 수 있도록 합니다.
          예산 미설정 시에는 안내 문구를 표시합니다.                    */}
      <div
        className="rounded-2xl p-4 flex flex-col gap-3"
        style={{ backgroundColor: 'var(--bg-secondary)' }}
      >
        {/* 예산 현황 3분할: 예산 / 지출 / 잔여 */}
        <div className="flex justify-between items-start">

          {/* 설정 예산 */}
          <div className="flex flex-col gap-0.5">
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>예산</span>
            <span className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
              {budget ? formatYen(budget.amount) : '미설정'}
            </span>
          </div>

          {/* 당월 지출 */}
          <div className="flex flex-col gap-0.5 items-center">
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>지출</span>
            <span className="text-base font-bold" style={{ color: 'var(--expense)' }}>
              {formatYen(totalExpense)}
            </span>
          </div>

          {/* 잔여 예산 — 예산 미설정 시 당월 순이익(수입-지출) 표시 */}
          <div className="flex flex-col gap-0.5 items-end">
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {budget ? '잔여' : '수입'}
            </span>
            <span
              className="text-base font-bold"
              style={{
                // 잔여 예산이 음수(초과)면 빨강, 양수면 초록, 예산 미설정 시 초록
                color: remaining !== null
                  ? (remaining >= 0 ? 'var(--income)' : 'var(--expense)')
                  : 'var(--income)',
              }}
            >
              {remaining !== null ? formatYen(Math.abs(remaining)) : formatYen(totalIncome)}
            </span>
          </div>
        </div>

        {/* 예산 소진 진행 바 — 예산 설정 시에만 표시 */}
        {budget && budget.amount > 0 && (
          <div className="flex flex-col gap-1">
            <div
              className="w-full rounded-full overflow-hidden"
              style={{ height: '6px', backgroundColor: 'var(--bg-card)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${budgetRatio * 100}%`,
                  // 90% 이상 소진 시 빨강 경고, 미만은 초록
                  backgroundColor: budgetRatio >= 0.9 ? 'var(--expense)' : 'var(--income)',
                }}
              />
            </div>
            <p className="text-xs text-right" style={{ color: 'var(--text-secondary)' }}>
              {Math.round(budgetRatio * 100)}% 소진
              {remaining !== null && remaining < 0 && (
                <span style={{ color: 'var(--expense)' }}> · {formatYen(Math.abs(remaining))} 초과</span>
              )}
            </p>
          </div>
        )}

        {/* 당월 수입 요약 — 항상 표시 */}
        {totalIncome > 0 && (
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            이번 달 수입{' '}
            <span style={{ color: 'var(--income)' }}>{formatYen(totalIncome)}</span>
          </p>
        )}
      </div>

      {/* ── 날짜별 거래 내역 목록 ────────────────────────────────
          거래가 없을 때는 빈 상태 안내 문구를 표시합니다.             */}
      {dayGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            이번 달 거래 내역이 없습니다.
          </p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            + 버튼을 눌러 첫 번째 내역을 추가해 보세요.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {dayGroups.map((group) => (
            <div key={group.date} className="flex flex-col gap-1">

              {/* ── 날짜 헤더 ── */}
              <div className="flex justify-between items-center px-1 mb-1">
                <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  {formatDateHeader(group.date)}
                </span>
                {/* 날짜별 수입/지출 소계 */}
                <div className="flex gap-2 text-xs">
                  {group.totalIncome > 0 && (
                    <span style={{ color: 'var(--income)' }}>+{formatYen(group.totalIncome)}</span>
                  )}
                  {group.totalExpense > 0 && (
                    <span style={{ color: 'var(--expense)' }}>-{formatYen(group.totalExpense)}</span>
                  )}
                </div>
              </div>

              {/* ── 해당 날짜의 거래 항목들 ── */}
              <div
                className="rounded-2xl overflow-hidden"
                style={{ backgroundColor: 'var(--bg-secondary)' }}
              >
                {group.transactions.map((tx, i) => (
                  <div key={tx.id ?? i}>
                    {/* 항목 간 구분선 (첫 번째 항목 제외) */}
                    {i > 0 && (
                      <div className="mx-4" style={{ height: '1px', backgroundColor: 'var(--border)' }} />
                    )}

                    {/* 거래 항목 행 */}
                    <div className="flex items-center justify-between px-4 py-3 gap-3">

                      {/* 왼쪽: 카테고리 칩 + 메모/설명 */}
                      <div className="flex items-center gap-2 min-w-0">
                        {/* 카테고리 칩 */}
                        <span
                          className="shrink-0 px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: tx.type === 'income'
                              ? 'rgba(52, 211, 153, 0.15)'   // --income 15% 투명도
                              : 'rgba(248, 113, 113, 0.15)', // --expense 15% 투명도
                            color: tx.type === 'income' ? 'var(--income)' : 'var(--expense)',
                          }}
                        >
                          {tx.category}
                        </span>

                        {/* 메모 또는 설명 — 길면 말줄임 처리 */}
                        {tx.memo && tx.memo !== tx.category && (
                          <span
                            className="text-sm truncate"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            {tx.memo}
                          </span>
                        )}
                      </div>

                      {/* 오른쪽: 금액 (수입=초록, 지출=빨강) */}
                      <span
                        className="shrink-0 text-sm font-semibold"
                        style={{
                          color: tx.type === 'income' ? 'var(--income)' : 'var(--expense)',
                        }}
                      >
                        {tx.type === 'income' ? '+' : '-'}{formatYen(tx.amount)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
