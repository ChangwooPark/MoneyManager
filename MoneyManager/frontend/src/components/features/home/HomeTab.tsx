'use client';

import { useState, useEffect, useRef } from 'react';
import { getTransactions, getBudget, deleteTransaction } from '@/lib/api';
import { Transaction, Budget } from '@/types';

// ─── Props 타입 정의 ───────────────────────────────────────────
interface HomeTabProps {
  yearMonth: string;   // 상단 연월 선택기에서 전달받은 현재 연월
  refreshKey: number;  // 거래 저장 완료 시 증가 → 목록 재조회 트리거
  onRefresh: () => void;              // 삭제 완료 후 전체 탭 갱신
  onEdit: (tx: Transaction) => void;  // 수정 버튼 클릭 → MainApp에서 폼 열기
}

// ─── 날짜별 그룹 타입 ──────────────────────────────────────────
interface DayGroup {
  date: string;
  transactions: Transaction[];
  totalIncome: number;
  totalExpense: number;
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
function formatYen(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`;
}

function createdAtSeconds(tx: Transaction): number {
  return tx.createdAt?._seconds ?? 0;
}

// ─── 거래 내역을 날짜별로 그룹화 ──────────────────────────────
function groupByDate(transactions: Transaction[]): DayGroup[] {
  const sorted = [...transactions].sort((a, b) => {
    if (b.date !== a.date) return b.date.localeCompare(a.date);
    return createdAtSeconds(b) - createdAtSeconds(a);
  });

  const map = new Map<string, Transaction[]>();
  for (const tx of sorted) {
    if (!map.has(tx.date)) map.set(tx.date, []);
    map.get(tx.date)!.push(tx);
  }

  return [...map.entries()].map(([date, txs]) => ({
    date,
    transactions: txs,
    totalIncome:  txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
    totalExpense: txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
  }));
}

// ─── HomeTab 컴포넌트 ──────────────────────────────────────────
export default function HomeTab({ yearMonth, refreshKey, onRefresh, onEdit }: HomeTabProps) {

  // ── 데이터 상태 ──────────────────────────────────────────────
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budget, setBudget]             = useState<Budget | null>(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');

  // ── 거래 상세 시트 상태 ───────────────────────────────────────
  const [selectedTx,    setSelectedTx]    = useState<Transaction | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError,   setDeleteError]   = useState('');

  // 상세 시트 본체 ref — iOS 배경 스크롤 차단 시 시트 내부 터치는 허용
  const detailSheetRef = useRef<HTMLDivElement>(null);

  // ── 상세 시트 열린 동안 배경 스크롤 차단 (iOS Safari 대응) ────
  useEffect(() => {
    if (!selectedTx) return;
    const prevent = (e: TouchEvent) => {
      if (detailSheetRef.current?.contains(e.target as Node)) return;
      e.preventDefault();
    };
    document.addEventListener('touchmove', prevent, { passive: false });
    return () => document.removeEventListener('touchmove', prevent);
  }, [selectedTx]);

  // ── 데이터 조회 ───────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError('');
      try {
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
  const totalIncome  = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const remaining    = budget ? budget.amount - totalExpense : null;
  const budgetRatio  = budget && budget.amount > 0
    ? Math.min(1, totalExpense / budget.amount)
    : 0;
  const dayGroups = groupByDate(transactions);

  // ── 상세 시트 닫기 ────────────────────────────────────────────
  const closeDetail = () => {
    setSelectedTx(null);
    setDeleteConfirm(false);
    setDeleteError('');
  };

  // ── 거래 삭제 ────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!selectedTx?.id) return;
    setDeleteLoading(true);
    setDeleteError('');
    try {
      await deleteTransaction(selectedTx.id);
      closeDetail();
      onRefresh(); // 목록 갱신
    } catch {
      setDeleteError('삭제에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setDeleteLoading(false);
    }
  };

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
    <>
      <div className="px-4 py-4 flex flex-col gap-4">

        {/* ── 예산 대시보드 ──────────────────────────────────────── */}
        <div
          className="rounded-2xl p-4 flex flex-col gap-3"
          style={{ backgroundColor: 'var(--bg-secondary)' }}
        >
          <div className="flex justify-between items-start">

            <div className="flex flex-col gap-0.5">
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>예산</span>
              <span className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                {budget ? formatYen(budget.amount) : '미설정'}
              </span>
            </div>

            <div className="flex flex-col gap-0.5 items-center">
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>지출</span>
              <span className="text-base font-bold" style={{ color: 'var(--expense)' }}>
                {formatYen(totalExpense)}
              </span>
            </div>

            <div className="flex flex-col gap-0.5 items-end">
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {budget ? '잔여' : '수입'}
              </span>
              <span
                className="text-base font-bold"
                style={{
                  color: remaining !== null
                    ? (remaining >= 0 ? 'var(--income)' : 'var(--expense)')
                    : 'var(--income)',
                }}
              >
                {remaining !== null ? formatYen(Math.abs(remaining)) : formatYen(totalIncome)}
              </span>
            </div>
          </div>

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

          {totalIncome > 0 && (
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              이번 달 수입{' '}
              <span style={{ color: 'var(--income)' }}>{formatYen(totalIncome)}</span>
            </p>
          )}
        </div>

        {/* ── 날짜별 거래 내역 목록 ──────────────────────────────── */}
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
            {dayGroups.map((group) => {
              const net = group.totalIncome - group.totalExpense;
              return (
                <div key={group.date} className="flex flex-col gap-1">

                  {/* ── 날짜 헤더 ── */}
                  {/* border-b: 날짜 헤더와 거래 항목 사이 시각적 구분선 */}
                  <div
                    className="flex justify-between items-center px-1 pb-1 mb-1"
                    style={{ borderBottom: '1px solid var(--border)' }}
                  >
                    <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                      {formatDateHeader(group.date)}
                    </span>

                    {/* 날짜별 수입/지출 소계 + 순수익 */}
                    <div className="flex gap-2 text-xs">
                      {group.totalIncome > 0 && (
                        <span style={{ color: 'var(--income)' }}>+{formatYen(group.totalIncome)}</span>
                      )}
                      {group.totalExpense > 0 && (
                        <span style={{ color: 'var(--expense)' }}>-{formatYen(group.totalExpense)}</span>
                      )}
                      {/* 수입과 지출이 모두 있을 때만 순수익(= income - expense) 표시 */}
                      {group.totalIncome > 0 && group.totalExpense > 0 && (
                        <span style={{ color: net >= 0 ? 'var(--income)' : 'var(--expense)' }}>
                          ={formatYen(Math.abs(net))}
                        </span>
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
                        {i > 0 && (
                          <div className="mx-4" style={{ height: '1px', backgroundColor: 'var(--border)' }} />
                        )}

                        {/* 거래 항목 행 — 클릭 시 상세 시트 열림 */}
                        <div
                          className="flex items-center justify-between px-4 py-3 gap-3 cursor-pointer active:opacity-60 transition-opacity"
                          onClick={() => { setSelectedTx(tx); setDeleteConfirm(false); setDeleteError(''); }}
                        >
                          {/* 왼쪽: 카테고리 칩 + 메모 */}
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="shrink-0 inline-flex items-center justify-center min-w-[3.5rem] px-2 py-0.5 rounded-full text-xs font-medium"
                              style={{
                                backgroundColor: tx.type === 'income'
                                  ? 'rgba(52, 211, 153, 0.15)'
                                  : 'rgba(248, 113, 113, 0.15)',
                                color: tx.type === 'income' ? 'var(--income)' : 'var(--expense)',
                              }}
                            >
                              {tx.category}
                            </span>
                            {/* 메모 — 있을 때만 표시, 긴 경우 말줄임 */}
                            {tx.memo && tx.memo !== tx.category && (
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
              );
            })}
          </div>
        )}
      </div>

      {/* ── 거래 상세 시트 ──────────────────────────────────────────
          selectedTx가 설정되면 하단에서 슬라이드업으로 표시됩니다.
          오버레이 클릭 → 닫힘, 시트 내부 클릭 → 이벤트 버블링 차단  */}
      {selectedTx && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
          onClick={closeDetail}
        >
          <div
            ref={detailSheetRef}
            className="rounded-t-2xl w-full max-w-md self-center"
            style={{ backgroundColor: 'var(--bg-secondary)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* 핸들 바 */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'var(--border)' }} />
            </div>

            {!deleteConfirm ? (
              /* ── 상세 보기 단계 ── */
              <div
                className="px-5 pb-8 flex flex-col gap-4"
                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)' }}
              >
                {/* 헤더 */}
                <div className="flex items-center justify-between pt-1">
                  <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                    거래 상세
                  </h2>
                  <button
                    onClick={closeDetail}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-xl"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    ✕
                  </button>
                </div>

                {/* 거래 정보 카드 */}
                <div
                  className="rounded-2xl p-4 flex flex-col gap-3"
                  style={{ backgroundColor: 'var(--bg-card)' }}
                >
                  {[
                    { label: '날짜',   value: formatDateHeader(selectedTx.date),                        color: 'var(--text-primary)' },
                    { label: '유형',   value: selectedTx.type === 'income' ? '수입' : '지출',            color: selectedTx.type === 'income' ? 'var(--income)' : 'var(--expense)' },
                    { label: '카테고리', value: selectedTx.category,                                    color: 'var(--text-primary)' },
                    { label: '금액',   value: `${selectedTx.type === 'income' ? '+' : '-'}${formatYen(selectedTx.amount)}`, color: selectedTx.type === 'income' ? 'var(--income)' : 'var(--expense)' },
                    ...(selectedTx.memo ? [{ label: '메모', value: selectedTx.memo, color: 'var(--text-secondary)' }] : []),
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex justify-between items-start gap-4">
                      <span className="text-sm shrink-0" style={{ color: 'var(--text-secondary)' }}>
                        {label}
                      </span>
                      <span className="text-sm font-medium text-right" style={{ color }}>
                        {value}
                      </span>
                    </div>
                  ))}
                </div>

                {/* 수정 / 삭제 버튼 */}
                <div className="flex gap-3">
                  <button
                    className="flex-1 py-3 rounded-xl text-sm font-bold border"
                    style={{
                      color: 'var(--accent)',
                      borderColor: 'var(--accent)',
                      backgroundColor: 'transparent',
                    }}
                    onClick={() => {
                      const tx = selectedTx;
                      closeDetail();
                      onEdit(tx); // MainApp에서 수정 폼 열기
                    }}
                  >
                    수정
                  </button>
                  <button
                    className="flex-1 py-3 rounded-xl text-sm font-bold"
                    style={{ backgroundColor: 'var(--expense)', color: '#fff' }}
                    onClick={() => setDeleteConfirm(true)}
                  >
                    삭제
                  </button>
                </div>
              </div>

            ) : (
              /* ── 삭제 확인 단계 ── */
              <div
                className="px-5 pb-8 flex flex-col gap-4"
                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)' }}
              >
                <div className="pt-2 text-center flex flex-col gap-1">
                  <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                    거래를 삭제하시겠습니까?
                  </p>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {selectedTx.category} {selectedTx.type === 'income' ? '+' : '-'}{formatYen(selectedTx.amount)}
                  </p>
                </div>

                {deleteError && (
                  <p className="text-xs text-center" style={{ color: 'var(--expense)' }}>{deleteError}</p>
                )}

                <div className="flex gap-3">
                  <button
                    className="flex-1 py-3 rounded-xl text-sm font-bold border"
                    style={{
                      color: 'var(--text-secondary)',
                      borderColor: 'var(--border)',
                      backgroundColor: 'transparent',
                    }}
                    onClick={() => { setDeleteConfirm(false); setDeleteError(''); }}
                  >
                    취소
                  </button>
                  <button
                    className="flex-1 py-3 rounded-xl text-sm font-bold disabled:opacity-50"
                    style={{ backgroundColor: 'var(--expense)', color: '#fff' }}
                    disabled={deleteLoading}
                    onClick={handleDelete}
                  >
                    {deleteLoading ? '삭제 중...' : '삭제'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
