'use client';

import { useState, useRef, useEffect } from 'react';
import { deleteTransaction } from '@/lib/api';
import { Transaction } from '@/types';

// ─── Props 타입 ────────────────────────────────────────────────
interface TransactionDetailSheetProps {
  transaction: Transaction;
  onClose:   () => void;
  onEdit:    (tx: Transaction) => void; // 수정 버튼 → MainApp에서 폼 열기
  onDeleted: () => void;                // 삭제 완료 → 부모에서 목록 갱신
}

// ─── 날짜 헤더 포맷 ────────────────────────────────────────────
function formatDateHeader(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${m}월 ${d}일 (${days[new Date(y, m - 1, d).getDay()]})`;
}

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`;
}

// ─── TransactionDetailSheet 컴포넌트 ──────────────────────────
// 거래 상세 보기 / 수정 / 삭제를 처리하는 공통 바텀시트입니다.
// HomeTab, CalendarTab, StatsTab 세 곳에서 재사용합니다.
// z-[70]/z-[80]: 달력·통계 하위 시트(z-50)와 통계 탭(z-[60]) 위에 표시되도록 설정
export default function TransactionDetailSheet({
  transaction, onClose, onEdit, onDeleted,
}: TransactionDetailSheetProps) {

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError,   setDeleteError]   = useState('');

  const sheetRef = useRef<HTMLDivElement>(null);

  // ── iOS 배경 스크롤 + Pull-to-Refresh 차단 ────────────────────
  useEffect(() => {
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
  }, []);

  // ── 삭제 처리 ────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!transaction.id) return;
    setDeleteLoading(true);
    setDeleteError('');
    try {
      await deleteTransaction(transaction.id);
      onClose();
      onDeleted();
    } catch {
      setDeleteError('삭제에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col justify-end"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        ref={sheetRef}
        className="rounded-t-2xl w-full max-w-md self-center"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          minHeight: '66vh',
          position: 'relative',
          zIndex: 80,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 핸들 바 */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'var(--border)' }} />
        </div>

        {!deleteConfirm ? (
          /* ── 상세 보기 ── */
          <div
            className="px-5 flex flex-col gap-4"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)' }}
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between pt-1">
              <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                거래 상세
              </h2>
              <button
                onClick={onClose}
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
                {
                  label: '날짜',
                  value: formatDateHeader(transaction.date),
                  color: 'var(--text-primary)',
                },
                {
                  label: '유형',
                  value: transaction.type === 'income' ? '수입' : '지출',
                  color: transaction.type === 'income' ? 'var(--income)' : 'var(--expense)',
                },
                {
                  label: '카테고리',
                  value: transaction.category,
                  color: 'var(--text-primary)',
                },
                {
                  label: '금액',
                  value: `${transaction.type === 'income' ? '+' : '-'}${formatYen(transaction.amount)}`,
                  color: transaction.type === 'income' ? 'var(--income)' : 'var(--expense)',
                },
                ...(transaction.memo
                  ? [{ label: '메모', value: transaction.memo, color: 'var(--text-secondary)' }]
                  : []),
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
                onClick={() => { onClose(); onEdit(transaction); }}
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
          /* ── 삭제 확인 ── */
          <div
            className="px-5 flex flex-col gap-4"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)' }}
          >
            <div className="pt-2 text-center flex flex-col gap-1">
              <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                거래를 삭제하시겠습니까?
              </p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {transaction.category}{' '}
                {transaction.type === 'income' ? '+' : '-'}{formatYen(transaction.amount)}
              </p>
            </div>

            {deleteError && (
              <p className="text-xs text-center" style={{ color: 'var(--expense)' }}>
                {deleteError}
              </p>
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
  );
}
