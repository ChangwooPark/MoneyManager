'use client';

import { useState, useEffect, useRef } from 'react';
import { getTransactions } from '@/lib/api';
import { Transaction } from '@/types';

// ─── Props 타입 정의 ───────────────────────────────────────────
interface StatsTabProps {
  yearMonth: string;
  refreshKey: number;
}

// ─── 카테고리 집계 결과 타입 ───────────────────────────────────
interface CategoryRow {
  category: string;
  count: number;
  total: number;
}

type TabType = 'income' | 'expense';
type SortDir = 'desc' | 'asc';

// 드래그 임계값 — 이 픽셀 이상 내리면 시트 닫힘
const DISMISS_THRESHOLD = 100;

// ─── 금액 포맷 ─────────────────────────────────────────────────
function formatYen(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`;
}

// ─── 날짜 헤더 포맷 ────────────────────────────────────────────
// "2026-06-18" → "6월 18일 (수)"
function formatDateHeader(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${m}월 ${d}일 (${days[date.getDay()]})`;
}

// ─── 카테고리별 집계 ───────────────────────────────────────────
function aggregateByCategory(
  transactions: Transaction[],
  type: TabType,
  sortDir: SortDir,
): CategoryRow[] {
  const filtered = transactions.filter(tx => tx.type === type);
  const map = new Map<string, CategoryRow>();
  for (const tx of filtered) {
    if (!map.has(tx.category)) {
      map.set(tx.category, { category: tx.category, count: 0, total: 0 });
    }
    const row = map.get(tx.category)!;
    row.count += 1;
    row.total += tx.amount;
  }
  const rows = Array.from(map.values());
  rows.sort((a, b) =>
    sortDir === 'desc' ? b.total - a.total : a.total - b.total
  );
  return rows;
}

// ─── StatsTab 컴포넌트 ────────────────────────────────────────
export default function StatsTab({ yearMonth, refreshKey }: StatsTabProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [activeTab, setActiveTab]       = useState<TabType>('expense');
  const [sortDir, setSortDir]           = useState<SortDir>('desc');

  // ── 카테고리 상세 시트 상태 ───────────────────────────────────
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [dragOffset, setDragOffset]             = useState(0);
  const [isDragging, setIsDragging]             = useState(false);
  const dragStartY = useRef<number | null>(null);
  const sheetRef   = useRef<HTMLDivElement>(null);

  // ── 데이터 조회 ───────────────────────────────────────────────
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

  // ── 수입/지출 탭 전환 시 시트 닫기 ─────────────────────────
  useEffect(() => {
    setSelectedCategory(null);
  }, [activeTab]);

  // ── 시트 열림/닫힘 시 드래그 상태 초기화 ────────────────────
  useEffect(() => {
    setDragOffset(0);
    setIsDragging(false);
    dragStartY.current = null;
  }, [selectedCategory]);

  // ── 시트 열린 동안 배경 스크롤 + Pull-to-Refresh 차단 ────────
  useEffect(() => {
    if (!selectedCategory) return;
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
  }, [selectedCategory]);

  // ── 집계 ─────────────────────────────────────────────────────
  const rows       = aggregateByCategory(transactions, activeTab, sortDir);
  const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);
  const grandCount = rows.reduce((sum, r) => sum + r.count, 0);

  // ── 선택된 카테고리의 거래 목록 (날짜 내림차순) ───────────────
  const selectedTransactions = selectedCategory
    ? [...transactions]
        .filter(tx => tx.type === activeTab && tx.category === selectedCategory)
        .sort((a, b) => {
          if (b.date !== a.date) return b.date.localeCompare(a.date);
          return (b.createdAt?._seconds ?? 0) - (a.createdAt?._seconds ?? 0);
        })
    : [];
  const selectedTotal = selectedTransactions.reduce((s, t) => s + t.amount, 0);

  // ── 시트 닫기 ────────────────────────────────────────────────
  const closeSheet = () => setSelectedCategory(null);

  // ── 드래그 핸들러 ────────────────────────────────────────────
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

  return (
    <div className="flex flex-col min-h-full">

      {/* ── 수입/지출 전환 탭 ────────────────────────────────── */}
      {/* sticky top-0 z-[60]: 카테고리 시트 오버레이(z-40)·시트(z-50) 위에 위치해
          시트가 열린 상태에서도 수입/지출 탭 전환이 가능하도록 유지합니다. */}
      <div
        className="flex border-b sticky top-0 z-[60]"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-primary)' }}
      >
        {(['expense', 'income'] as TabType[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 py-3 text-sm font-semibold transition-colors"
            style={{
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

      {/* ── 로딩 상태 ────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center h-48">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>불러오는 중...</p>
        </div>
      )}

      {/* ── 오류 상태 ────────────────────────────────────────── */}
      {!loading && error && (
        <div className="flex items-center justify-center h-48">
          <p className="text-sm" style={{ color: 'var(--expense)' }}>{error}</p>
        </div>
      )}

      {/* ── 데이터 영역 ──────────────────────────────────────── */}
      {!loading && !error && (
        <div className="px-4 pt-4 pb-8">

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
                  style={{ color: activeTab === 'income' ? 'var(--income)' : 'var(--expense)' }}
                >
                  {formatYen(grandTotal)}
                </span>
              </div>

              {/* 테이블 헤더 + 정렬 버튼 */}
              <div
                className="flex items-center px-4 py-2 mb-1"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <span className="flex-1 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  내용
                </span>
                <span className="w-12 text-center text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  건수
                </span>
                <button
                  onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
                  className="w-28 flex items-center justify-end gap-1"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <span className="text-xs font-semibold">금액</span>
                  <span className="text-xs">{sortDir === 'desc' ? '↓' : '↑'}</span>
                </button>
              </div>

              {/* 카테고리별 행 목록 */}
              <div
                className="rounded-2xl overflow-hidden"
                style={{ backgroundColor: 'var(--bg-card)' }}
              >
                {rows.map((row, i) => (
                  <div key={row.category}>
                    {i > 0 && (
                      <div className="mx-4" style={{ height: '1px', backgroundColor: 'var(--border)' }} />
                    )}

                    {/* 카테고리 행 — 클릭 시 상세 시트 열림 */}
                    <div
                      className="flex items-center px-4 py-3 gap-2 cursor-pointer active:opacity-60 transition-opacity"
                      onClick={() => setSelectedCategory(row.category)}
                    >
                      {/* 내용: 카테고리명 + 비율 바 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            {row.category}
                          </span>
                          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                            {grandTotal > 0 ? `${Math.round((row.total / grandTotal) * 100)}%` : '0%'}
                          </span>
                        </div>
                        <div
                          className="h-1 rounded-full overflow-hidden"
                          style={{ backgroundColor: 'var(--border)' }}
                        >
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: grandTotal > 0 ? `${(row.total / grandTotal) * 100}%` : '0%',
                              backgroundColor: activeTab === 'income' ? 'var(--income)' : 'var(--expense)',
                            }}
                          />
                        </div>
                      </div>

                      {/* 건수 */}
                      <span className="w-12 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {row.count}
                      </span>

                      {/* 금액 */}
                      <span
                        className="w-28 text-right text-sm font-semibold"
                        style={{ color: activeTab === 'income' ? 'var(--income)' : 'var(--expense)' }}
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

      {/* ── 카테고리 상세 시트 ───────────────────────────────────
          selectedCategory가 설정되면 하단 오버레이 + 시트를 표시합니다.
          오버레이 클릭 → 닫힘, 핸들 바 드래그 → 스냅백 or 닫힘             */}
      {selectedCategory && (
        <>
          {/* 반투명 오버레이 — 드래그 거리에 따라 점차 투명해짐 */}
          <div
            className="fixed inset-0 z-40"
            style={{ backgroundColor: `rgba(0,0,0,${Math.max(0.1, 0.45 - dragOffset / 400)})` }}
            onClick={closeSheet}
          />

          {/* 시트 본체 */}
          <div
            ref={sheetRef}
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
            {/* 핸들 바 — 드래그로 닫기 */}
            <div
              className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing"
              onTouchStart={handleDragStart}
              onTouchMove={handleDragMove}
              onTouchEnd={handleDragEnd}
            >
              <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'var(--border)' }} />
            </div>

            {/* 헤더: 카테고리명 + 합계 금액 + 닫기 버튼 */}
            <div
              className="flex justify-between items-center px-4 py-2"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                  {selectedCategory}
                </span>
                <span
                  className="text-sm font-bold shrink-0"
                  style={{ color: activeTab === 'income' ? 'var(--income)' : 'var(--expense)' }}
                >
                  {activeTab === 'income' ? '+' : '-'}{formatYen(selectedTotal)}
                </span>
              </div>
              <button
                onClick={closeSheet}
                className="text-lg leading-none px-2 py-1 shrink-0"
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
                  거래 내역이 없습니다.
                </p>
              ) : (
                <div
                  className="rounded-2xl overflow-hidden"
                  style={{ backgroundColor: 'var(--bg-card)' }}
                >
                  {selectedTransactions.map((tx, i) => (
                    <div key={tx.id ?? i}>
                      {i > 0 && (
                        <div className="mx-4" style={{ height: '1px', backgroundColor: 'var(--border)' }} />
                      )}
                      <div className="flex items-center justify-between px-4 py-3 gap-3">
                        {/* 왼쪽: 날짜 + 메모 */}
                        <div className="flex flex-col min-w-0 gap-0.5">
                          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                            {formatDateHeader(tx.date)}
                          </span>
                          {/* 메모가 카테고리와 다를 때만 표시 */}
                          {tx.memo && tx.memo !== tx.category && (
                            <span className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                              {tx.memo}
                            </span>
                          )}
                        </div>
                        {/* 오른쪽: 금액 */}
                        <span
                          className="shrink-0 text-sm font-semibold"
                          style={{ color: activeTab === 'income' ? 'var(--income)' : 'var(--expense)' }}
                        >
                          {activeTab === 'income' ? '+' : '-'}{formatYen(tx.amount)}
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
