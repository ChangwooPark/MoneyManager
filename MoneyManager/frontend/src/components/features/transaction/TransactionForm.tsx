'use client';

import { useState } from 'react';
import { createTransaction } from '@/lib/api';
import { Transaction } from '@/types';

// ─── Props 타입 정의 ───────────────────────────────────────────
interface TransactionFormProps {
  onClose: () => void;   // 폼을 닫을 때 호출 (취소 또는 저장 완료 후)
  onSaved: () => void;   // 저장 성공 후 부모에게 알려 목록을 갱신하게 함
}

// ─── 오늘 날짜를 YYYY-MM-DD 형식으로 반환하는 함수 ─────────────
// input[type="date"]의 기본값으로 사용합니다.
function getTodayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ─── 금액을 엔화 형식으로 포맷하는 함수 ────────────────────────
// 예: 12000 → "¥12,000"
function formatYen(value: number): string {
  return `¥${value.toLocaleString('ja-JP')}`;
}

// ─── TransactionForm 컴포넌트 ──────────────────────────────────
// 수입/지출 내역을 입력하는 바텀 시트(Bottom Sheet) 형태의 폼입니다.
// 화면 하단에서 슬라이드업 되는 방식으로 표시됩니다.
export default function TransactionForm({ onClose, onSaved }: TransactionFormProps) {

  // ── 폼 입력 상태 ──────────────────────────────────────────────
  const [type, setType]           = useState<'income' | 'expense'>('expense'); // 기본값: 지출
  const [date, setDate]           = useState(getTodayString());                // 기본값: 오늘
  const [category, setCategory]   = useState('');                              // 카테고리(내용)
  const [amount, setAmount]       = useState('');                              // 금액 (문자열로 관리 후 저장 시 숫자 변환)
  const [memo, setMemo]           = useState('');                              // 메모 (선택 항목)
  const [loading, setLoading]     = useState(false);                          // 저장 중 여부
  const [error, setError]         = useState('');                              // 유효성 검사 오류 메시지

  // ── 저장 처리 함수 ────────────────────────────────────────────
  const handleSave = async () => {
    // 유효성 검사: 필수 항목 확인
    if (!category.trim()) { setError('카테고리를 입력해 주세요'); return; }
    if (!amount || Number(amount) <= 0) { setError('금액을 입력해 주세요'); return; }

    setLoading(true);
    setError('');

    try {
      // Transaction 타입에 맞춰 데이터 구성
      const data: Omit<Transaction, 'id' | 'createdAt'> = {
        type,
        date,
        category: category.trim(),
        amount: Number(amount),           // 문자열 → 숫자 변환
        description: category.trim(),     // 백엔드 스키마 호환용 (category와 동일하게)
        memo: memo.trim() || undefined,   // 빈 문자열이면 undefined로 전송하지 않음
      };

      await createTransaction(data);
      onSaved();  // 부모에게 저장 완료 알림 → 목록 갱신
      onClose();  // 폼 닫기
    } catch {
      setError('저장에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  // ── 금액 입력 처리: 숫자만 허용 ──────────────────────────────
  const handleAmountChange = (value: string) => {
    // 숫자가 아닌 문자 입력 시 무시 (정규식으로 필터링)
    if (value === '' || /^\d+$/.test(value)) {
      setAmount(value);
    }
  };

  // ── 현재 선택된 타입에 따른 강조색 ───────────────────────────
  const accentColor = type === 'income' ? 'var(--income)' : 'var(--expense)';

  return (
    // ── 오버레이 (배경 어둡게) ────────────────────────────────
    // 폼 바깥 영역을 클릭하면 폼이 닫힘
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      {/* ── 바텀 시트 본체 ────────────────────────────────────
          stopPropagation: 폼 내부 클릭이 오버레이 클릭으로 전파되는 것을 막음
          max-h-[90vh]: 화면의 90% 이상을 차지하지 않도록 최대 높이 제한
          overflow-y-auto: 내용이 길면 폼 내부에서 스크롤 (키보드 올라와도 레이아웃 유지)
      */}
      <div
        className="rounded-t-2xl overflow-y-auto"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          maxHeight: '90vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── 상단 핸들 바 (드래그 힌트용 UI) ──────────────── */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'var(--border)' }} />
        </div>

        <div className="px-5 pb-8 pt-2 flex flex-col gap-5">

          {/* ── 헤더: 제목 + 닫기 버튼 ─────────────────────── */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              내역 추가
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full text-xl"
              style={{ color: 'var(--text-secondary)' }}
            >
              ✕
            </button>
          </div>

          {/* ── 수입 / 지출 토글 ──────────────────────────── */}
          <div
            className="flex rounded-xl p-1"
            style={{ backgroundColor: 'var(--bg-card)' }}
          >
            {(['expense', 'income'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
                style={{
                  // 선택된 타입은 배경색과 텍스트색 강조
                  backgroundColor: type === t ? (t === 'income' ? 'var(--income)' : 'var(--expense)') : 'transparent',
                  color: type === t ? '#000' : 'var(--text-secondary)',
                }}
              >
                {t === 'expense' ? '지출' : '수입'}
              </button>
            ))}
          </div>

          {/* ── 날짜 입력 ─────────────────────────────────── */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              날짜
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              // 입력창 스타일 — 다크 테마에 맞게 색상 커스텀
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                colorScheme: 'dark', // 날짜 피커를 다크 모드로 표시
              }}
            />
          </div>

          {/* ── 카테고리(내용) 입력 ──────────────────────── */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              내용
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="예: 점심 식사, 교통비"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none placeholder-gray-600"
              style={{
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
              }}
            />
          </div>

          {/* ── 금액 입력 ─────────────────────────────────── */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              금액
            </label>
            <div className="relative">
              {/* 엔화 기호(¥)를 입력창 왼쪽에 표시 */}
              <span
                className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold"
                style={{ color: accentColor }}
              >
                ¥
              </span>
              <input
                type="text"
                inputMode="numeric"   // 모바일에서 숫자 키패드 표시
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="0"
                className="w-full pl-9 pr-4 py-3 rounded-xl text-sm outline-none placeholder-gray-600"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  border: `1px solid var(--border)`,
                }}
              />
              {/* 금액 입력 시 오른쪽에 포맷된 값 미리보기 */}
              {amount && (
                <span
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-xs"
                  style={{ color: accentColor }}
                >
                  {formatYen(Number(amount))}
                </span>
              )}
            </div>
          </div>

          {/* ── 메모 입력 (선택 항목) ───────────────────────── */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              메모 <span style={{ color: 'var(--text-secondary)', fontWeight: 'normal' }}>(선택)</span>
            </label>
            <input
              type="text"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="추가 메모를 입력하세요"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none placeholder-gray-600"
              style={{
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
              }}
            />
          </div>

          {/* ── 유효성 검사 오류 메시지 ──────────────────── */}
          {error && (
            <p className="text-sm text-center" style={{ color: 'var(--expense)' }}>
              {error}
            </p>
          )}

          {/* ── 저장 버튼 ─────────────────────────────────── */}
          <button
            onClick={handleSave}
            disabled={loading}
            className="w-full py-4 rounded-xl font-bold text-sm transition-all active:scale-95 disabled:opacity-50"
            style={{
              backgroundColor: accentColor,  // 수입이면 초록, 지출이면 빨강
              color: '#000',
            }}
          >
            {loading ? '저장 중...' : '저장'}
          </button>

        </div>
      </div>
    </div>
  );
}
