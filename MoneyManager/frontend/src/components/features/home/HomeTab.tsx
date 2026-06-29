'use client';

import { useState, useEffect } from 'react';
import { getTransactions, getBudget } from '@/lib/api';
import { Transaction, Budget } from '@/types';
import TransactionDetailSheet from '../transaction/TransactionDetailSheet';
import { useLanguage } from '@/contexts/LanguageContext';

// ─── Props 타입 정의 ───────────────────────────────────────────
interface HomeTabProps {
  yearMonth: string;
  refreshKey: number;
  onRefresh: () => void;
  onEdit: (tx: Transaction) => void;
}

// ─── 날짜별 그룹 타입 ──────────────────────────────────────────
interface DayGroup {
  date: string;
  transactions: Transaction[];
  totalIncome: number;
  totalExpense: number;
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
  const { t, formatDateHeader } = useLanguage();

  // ── 데이터 상태 ──────────────────────────────────────────────
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budget, setBudget]             = useState<Budget | null>(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');

  // ── 거래 상세 시트 상태 ───────────────────────────────────────
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  // ── 데이터 조회 ───────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError('');
      try {
        const [txList, b] = await Promise.all([
          getTransactions(yearMonth),
          getBudget(yearMonth).catch(() => null),
        ]);
        if (!cancelled) {
          setTransactions(txList);
          setBudget(b);
        }
      } catch {
        if (!cancelled) setError(t('loadError'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [yearMonth, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 집계값 계산 ───────────────────────────────────────────────
  const totalIncome  = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const remaining    = budget ? budget.amount - totalExpense : null;
  const budgetRatio  = budget && budget.amount > 0
    ? Math.min(1, totalExpense / budget.amount)
    : 0;
  const dayGroups = groupByDate(transactions);

  // ── 로딩 / 오류 상태 렌더링 ─────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('loading')}</p>
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
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('budget')}</span>
              <span className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                {budget ? formatYen(budget.amount) : t('budgetNotSet')}
              </span>
            </div>

            <div className="flex flex-col gap-0.5 items-center">
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('expense')}</span>
              <span className="text-base font-bold" style={{ color: 'var(--expense)' }}>
                {formatYen(totalExpense)}
              </span>
            </div>

            <div className="flex flex-col gap-0.5 items-end">
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {budget ? t('remaining') : t('income')}
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
                {Math.round(budgetRatio * 100)}{t('spent')}
                {remaining !== null && remaining < 0 && (
                  <span style={{ color: 'var(--expense)' }}> · {formatYen(Math.abs(remaining))} {t('over')}</span>
                )}
              </p>
            </div>
          )}

          {totalIncome > 0 && (
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {t('monthlyIncome')}{' '}
              <span style={{ color: 'var(--income)' }}>{formatYen(totalIncome)}</span>
            </p>
          )}
        </div>

        {/* ── 날짜별 거래 내역 목록 ──────────────────────────────── */}
        {dayGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {t('noTransactions')}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {t('noTransactionsHint')}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {dayGroups.map((group) => {
              const net = group.totalIncome - group.totalExpense;
              return (
                <div key={group.date} className="flex flex-col gap-1">

                  {/* ── 날짜 헤더 ── */}
                  <div
                    className="flex justify-between items-center px-1 pb-1 mb-1"
                    style={{ borderBottom: '1px solid var(--border)' }}
                  >
                    <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                      {formatDateHeader(group.date)}
                    </span>

                    <div className="flex gap-2 text-xs">
                      {group.totalIncome > 0 && (
                        <span style={{ color: 'var(--income)' }}>+{formatYen(group.totalIncome)}</span>
                      )}
                      {group.totalExpense > 0 && (
                        <span style={{ color: 'var(--expense)' }}>-{formatYen(group.totalExpense)}</span>
                      )}
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

                        <div
                          className="flex items-center justify-between px-4 py-3 gap-3 cursor-pointer active:opacity-60 transition-opacity"
                          onClick={() => setSelectedTx(tx)}
                        >
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
                            {tx.memo && tx.memo !== tx.category && (
                              <span
                                className="text-sm truncate"
                                style={{ color: 'var(--text-secondary)' }}
                              >
                                {tx.memo}
                              </span>
                            )}
                          </div>

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

      {/* ── 거래 상세 시트 ──────────────────────────────────────── */}
      {selectedTx && (
        <TransactionDetailSheet
          transaction={selectedTx}
          onClose={() => setSelectedTx(null)}
          onEdit={onEdit}
          onDeleted={onRefresh}
        />
      )}
    </>
  );
}
