'use client';

import { useState, useEffect } from 'react';
import { getTransactions } from '@/lib/api';
import { Transaction } from '@/types';

// ─── Props 타입 정의 ───────────────────────────────────────────
interface StatsTabProps {
  yearMonth: string;  // 상단 연월 선택기에서 전달받은 현재 연월 (예: "2026-06")
  refreshKey: number; // 거래 저장 완료 시 증가 → 통계도 자동 갱신
}

// ─── 카테고리 집계 결과 타입 ───────────────────────────────────
// 수입 또는 지출 거래를 카테고리별로 집계한 한 행(row)의 데이터입니다.
interface CategoryRow {
  category: string;  // 카테고리명 (예: "식비", "급여")
  count: number;     // 해당 카테고리 거래 건수
  total: number;     // 해당 카테고리 총 금액
}

// ─── 수입/지출 탭 타입 ─────────────────────────────────────────
type TabType = 'income' | 'expense';

// ─── 정렬 방향 타입 ────────────────────────────────────────────
type SortDir = 'desc' | 'asc'; // desc = 금액 높은 순, asc = 금액 낮은 순

// ─── 금액 엔화 포맷 함수 ───────────────────────────────────────
// 12000 → "¥12,000"
function formatYen(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`;
}

// ─── 거래 목록을 카테고리별로 집계하는 함수 ─────────────────
// type 필터 후 카테고리 단위로 count·total을 합산합니다.
function aggregateByCategory(
  transactions: Transaction[],
  type: TabType,
  sortDir: SortDir,
): CategoryRow[] {
  // 1. 해당 타입(수입/지출)만 필터
  const filtered = transactions.filter(tx => tx.type === type);

  // 2. 카테고리별 집계 Map 생성
  const map = new Map<string, CategoryRow>();
  for (const tx of filtered) {
    if (!map.has(tx.category)) {
      map.set(tx.category, { category: tx.category, count: 0, total: 0 });
    }
    const row = map.get(tx.category)!;
    row.count += 1;
    row.total += tx.amount;
  }

  // 3. Map → 배열 변환 후 금액 기준 정렬
  const rows = Array.from(map.values());
  rows.sort((a, b) =>
    sortDir === 'desc' ? b.total - a.total : a.total - b.total
  );

  return rows;
}

// ─── StatsTab 컴포넌트 ────────────────────────────────────────
// 통계 탭 화면입니다.
// 해당 월의 거래 내역을 불러와 수입/지출을 카테고리별로 집계·표시합니다.
export default function StatsTab({ yearMonth, refreshKey }: StatsTabProps) {
  // 해당 월 전체 거래 목록
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 현재 선택된 탭: 'income'(수입) 또는 'expense'(지출)
  const [activeTab, setActiveTab] = useState<TabType>('expense');

  // 금액 정렬 방향: desc(높은 순, 기본값) 또는 asc(낮은 순)
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // ── 데이터 조회 ────────────────────────────────────────────
  // yearMonth 또는 refreshKey 변경 시 해당 월 거래 내역을 다시 불러옵니다.
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

  // ── 카테고리별 집계 ──────────────────────────────────────
  const rows = aggregateByCategory(transactions, activeTab, sortDir);

  // ── 해당 탭 전체 합계 ────────────────────────────────────
  const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);
  const grandCount = rows.reduce((sum, r) => sum + r.count, 0);

  return (
    <div className="flex flex-col min-h-full">

      {/* ── 수입/지출 전환 탭 ────────────────────────────── */}
      {/* sticky top-0: 콘텐츠 스크롤 시 탭 바가 main 상단에 고정
          bg-primary 지정 필수 — 없으면 스크롤 콘텐츠가 뒤에 비침 */}
      <div
        className="flex border-b sticky top-0 z-10"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-primary)' }}
      >
        {(['expense', 'income'] as TabType[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 py-3 text-sm font-semibold transition-colors"
            style={{
              // 선택된 탭: 강조색 텍스트 + 하단 밑줄
              color: activeTab === tab
                ? (tab === 'income' ? 'var(--income)' : 'var(--expense)')
                : 'var(--text-secondary)',
              borderBottom: activeTab === tab
                ? `2px solid ${tab === 'income' ? 'var(--income)' : 'var(--expense)'}`
                : '2px solid transparent',
            }}
          >
            {tab === 'income' ? '수입' : '지출'}
          </button>
        ))}
      </div>

      {/* ── 로딩 상태 ────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center h-48">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>불러오는 중...</p>
        </div>
      )}

      {/* ── 오류 상태 ────────────────────────────────────── */}
      {!loading && error && (
        <div className="flex items-center justify-center h-48">
          <p className="text-sm" style={{ color: 'var(--expense)' }}>{error}</p>
        </div>
      )}

      {/* ── 데이터 영역 ──────────────────────────────────── */}
      {!loading && !error && (
        <div className="px-4 pt-4 pb-8">

          {/* 집계 없음 — 빈 상태 */}
          {rows.length === 0 ? (
            <div className="flex items-center justify-center h-48">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                이번 달 {activeTab === 'income' ? '수입' : '지출'} 내역이 없습니다.
              </p>
            </div>
          ) : (
            <>
              {/* 합계 요약 행 */}
              <div
                className="flex items-center justify-between px-4 py-3 rounded-2xl mb-3"
                style={{ backgroundColor: 'var(--bg-secondary)' }}
              >
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  총 {grandCount}건
                </span>
                <span
                  className="text-base font-bold"
                  style={{
                    color: activeTab === 'income' ? 'var(--income)' : 'var(--expense)',
                  }}
                >
                  {formatYen(grandTotal)}
                </span>
              </div>

              {/* 테이블 헤더 + 정렬 버튼 */}
              <div
                className="flex items-center px-4 py-2 mb-1"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                {/* 내용 컬럼 (좌측, 넓게) */}
                <span
                  className="flex-1 text-xs font-semibold"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  내용
                </span>

                {/* 건수 컬럼 (중앙) */}
                <span
                  className="w-12 text-center text-xs font-semibold"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  건수
                </span>

                {/* 금액 컬럼 + 정렬 토글 버튼 (우측) */}
                <button
                  onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
                  className="w-28 flex items-center justify-end gap-1"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <span className="text-xs font-semibold">금액</span>
                  {/* 정렬 방향 화살표 아이콘 */}
                  <span className="text-xs">
                    {sortDir === 'desc' ? '↓' : '↑'}
                  </span>
                </button>
              </div>

              {/* 카테고리별 행 목록 */}
              <div
                className="rounded-2xl overflow-hidden"
                style={{ backgroundColor: 'var(--bg-card)' }}
              >
                {rows.map((row, i) => (
                  <div key={row.category}>
                    {/* 구분선 (첫 항목 제외) */}
                    {i > 0 && (
                      <div
                        className="mx-4"
                        style={{ height: '1px', backgroundColor: 'var(--border)' }}
                      />
                    )}

                    {/* 카테고리 행 */}
                    <div className="flex items-center px-4 py-3 gap-2">

                      {/* 내용: 카테고리명 + 비율 바 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className="text-sm font-medium"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {row.category}
                          </span>
                          {/* 전체 대비 비율 (%) */}
                          <span
                            className="text-xs"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            {grandTotal > 0
                              ? `${Math.round((row.total / grandTotal) * 100)}%`
                              : '0%'}
                          </span>
                        </div>

                        {/* 비율 게이지 바 */}
                        <div
                          className="h-1 rounded-full overflow-hidden"
                          style={{ backgroundColor: 'var(--border)' }}
                        >
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: grandTotal > 0
                                ? `${(row.total / grandTotal) * 100}%`
                                : '0%',
                              backgroundColor: activeTab === 'income'
                                ? 'var(--income)'
                                : 'var(--expense)',
                            }}
                          />
                        </div>
                      </div>

                      {/* 건수 */}
                      <span
                        className="w-12 text-center text-sm"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {row.count}
                      </span>

                      {/* 금액 */}
                      <span
                        className="w-28 text-right text-sm font-semibold"
                        style={{
                          color: activeTab === 'income'
                            ? 'var(--income)'
                            : 'var(--expense)',
                        }}
                      >
                        {formatYen(row.total)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
