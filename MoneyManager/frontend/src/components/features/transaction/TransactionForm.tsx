'use client';

import { useState, useRef, useEffect } from 'react';
import { createTransaction, updateTransaction, getCategories } from '@/lib/api';
import { Transaction } from '@/types';

// API 조회 실패 시 사용할 기본 카테고리 목록
const FALLBACK_CATEGORIES: Record<'income' | 'expense', string[]> = {
  expense: ['식비', '교통', '쇼핑', '의료', '통신', '여가', '공과금', '생활', '기타'],
  income:  ['급여', '부업', '이자', '보너스', '기타'],
};

// 이 픽셀 이상 아래로 드래그하면 모달이 닫힘
const DISMISS_THRESHOLD = 100;

// ─── Props 타입 정의 ───────────────────────────────────────────
interface TransactionFormProps {
  onClose: () => void;
  onSaved: () => void;
  initialData?: Transaction; // 제공 시 수정 모드 (PUT), 미제공 시 추가 모드 (POST)
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
// 핸들 바를 아래로 드래그하면 닫히고, 카테고리 칩으로 분류를 선택합니다.
export default function TransactionForm({ onClose, onSaved, initialData }: TransactionFormProps) {
  // initialData가 있으면 수정 모드
  const isEdit = !!initialData?.id;

  // ── 폼 입력 상태 ──────────────────────────────────────────────
  const [type, setType]         = useState<'income' | 'expense'>(initialData?.type ?? 'expense');
  const [date, setDate]         = useState(initialData?.date ?? getTodayString());
  const [category, setCategory] = useState(initialData?.category ?? '');
  const [amount, setAmount]     = useState(initialData?.amount ? String(initialData.amount) : '');
  const [memo, setMemo]         = useState(initialData?.memo ?? '');
  const [loading, setLoading]   = useState(false);  // 저장 중 여부
  const [error, setError]       = useState('');     // 유효성 검사 오류 메시지

  // ── API 카테고리 상태 ─────────────────────────────────────────
  // 초기값: 하드코딩 폴백 → API 응답 도착 시 교체 (로딩 중 빈 화면 방지)
  const [apiCategories, setApiCategories] = useState<Record<'income' | 'expense', string[]>>(FALLBACK_CATEGORIES);

  useEffect(() => {
    Promise.all([getCategories('expense'), getCategories('income')])
      .then(([exp, inc]) => {
        setApiCategories({
          expense: exp.map(c => c.name),
          income:  inc.map(c => c.name),
        });
      })
      .catch(() => {}); // 실패 시 폴백 유지
  }, []);

  // ── 바텀시트 ref ─────────────────────────────────────────────
  // 배경 스크롤 차단 시 시트 내부 터치는 허용하기 위해 필요
  const sheetRef = useRef<HTMLDivElement>(null);

  // ── 모달 열린 동안 배경 스크롤 차단 (iOS Safari 대응) ────────
  // iOS Safari는 내부 요소의 overflow:hidden을 무시하므로
  // document 레벨에서 touchmove의 preventDefault()가 필요합니다.
  // { passive: false }가 없으면 preventDefault()를 호출할 수 없습니다.
  useEffect(() => {
    const prevent = (e: TouchEvent) => {
      // 시트 내부 터치는 차단하지 않음 → 시트 콘텐츠 스크롤 정상 동작
      if (sheetRef.current?.contains(e.target as Node)) return;
      e.preventDefault();
    };
    document.addEventListener('touchmove', prevent, { passive: false });
    return () => document.removeEventListener('touchmove', prevent);
  }, []);

  // ── 드래그로 닫기 상태 ────────────────────────────────────────
  // dragStartY: ref 사용 — 터치 이동마다 state 업데이트 비용 절감
  const dragStartY = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);   // 현재 드래그 거리(px)
  const [isDragging, setIsDragging] = useState(false); // 드래그 중 여부 (transition 제어용)

  // ── 수입/지출 전환 — 카테고리 초기화 ────────────────────────
  // 지출 카테고리(식비·교통…)와 수입 카테고리(급여·부업…)는 별개이므로 전환 시 리셋
  const handleTypeChange = (newType: 'income' | 'expense') => {
    setType(newType);
    setCategory('');
  };

  // ── 저장 처리 함수 ────────────────────────────────────────────
  const handleSave = async () => {
    // 유효성 검사: 필수 항목 확인
    if (!category)                         { setError('카테고리를 선택해 주세요'); return; }
    if (!amount || Number(amount) <= 0)    { setError('금액을 입력해 주세요'); return; }

    setLoading(true);
    setError('');

    try {
      // Transaction 타입에 맞춰 데이터 구성
      const data: Omit<Transaction, 'id' | 'createdAt'> = {
        type,
        date,
        category,
        amount: Number(amount),
        description: memo.trim() || category,
        memo: memo.trim() || undefined,
      };

      // 수정 모드: PUT /transactions/:id, 추가 모드: POST /transactions
      if (isEdit && initialData?.id) {
        await updateTransaction(initialData.id, data);
      } else {
        await createTransaction(data);
      }
      onSaved();
      onClose();
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

  // ── 드래그로 닫기 핸들러 (핸들 바에만 부착) ─────────────────
  // 핸들 바를 아래로 드래그 → 오버레이가 페이드되며 시트가 내려감
  // DISMISS_THRESHOLD 이상이면 닫힘, 미만이면 스냅백
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
      onClose();
    } else {
      setDragOffset(0); // 스냅백
    }
    dragStartY.current = null;
    setIsDragging(false);
  };

  // ── 현재 선택된 타입에 따른 강조색 ───────────────────────────
  const accentColor = type === 'income' ? 'var(--income)' : 'var(--expense)';
  const categories  = apiCategories[type];
  // 드래그 거리에 따라 오버레이를 점차 투명하게 (닫힐 것임을 시각적으로 표현)
  const overlayOpacity = Math.max(0.05, 0.6 - dragOffset / 400);

  return (
    // ── 오버레이 (배경 어둡게) ────────────────────────────────
    // 폼 바깥 영역을 클릭하면 폼이 닫힘
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ backgroundColor: `rgba(0,0,0,${overlayOpacity})` }}
      onClick={onClose}
    >
      {/* ── 바텀 시트 본체 ──────────────────────────────────────
          w-full max-w-md self-center: 앱 컨테이너(max-w-md) 너비로 제한
            - 모바일: 화면 너비 전체 사용
            - 웹 데스크톱: 448px 너비로 중앙 정렬 (뷰포트 전체를 채우지 않음)
          transform translateY: 드래그 거리만큼 시트를 아래로 이동
          transition: 드래그 중에는 즉각 반응, 스냅백/종료 시에는 부드럽게
          modal-sheet-max-height: 90dvh - safe-area-inset-bottom (globals.css)
      */}
      <div
        ref={sheetRef}
        className="rounded-t-2xl overflow-y-auto modal-sheet-max-height w-full max-w-md self-center"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          transform: `translateY(${dragOffset}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── 핸들 바 — 드래그로 닫기 터치 영역 ────────────────
            pb-3으로 터치 타깃 확보, 커서로 드래그 가능임을 표시 */}
        <div
          className="flex justify-center pt-3 pb-3 cursor-grab active:cursor-grabbing"
          onTouchStart={handleDragStart}
          onTouchMove={handleDragMove}
          onTouchEnd={handleDragEnd}
        >
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'var(--border)' }} />
        </div>

        {/* ── 폼 본문 ────────────────────────────────────────────
            px-5: 좌우 패딩
            pt-2: 핸들 바 아래 상단 여백
            paddingBottom: 기본 2rem + iOS 홈 인디케이터 safe area —
              브라우저 모드에서는 0이므로 영향 없음,
              PWA 모드에서는 ~34px 추가되어 저장 버튼이 홈 인디케이터 뒤로 숨는 문제 방지 */}
        <div
          className="px-5 pt-2 flex flex-col gap-5"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)' }}
        >

          {/* ── 헤더: 제목 + 닫기 버튼 ─────────────────────── */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              {isEdit ? '내역 수정' : '내역 추가'}
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
          <div className="flex rounded-xl p-1" style={{ backgroundColor: 'var(--bg-card)' }}>
            {(['expense', 'income'] as const).map((t) => (
              <button
                key={t}
                onClick={() => handleTypeChange(t)}
                className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
                style={{
                  // 선택된 타입은 배경색과 텍스트색 강조
                  backgroundColor: type === t
                    ? (t === 'income' ? 'var(--income)' : 'var(--expense)')
                    : 'transparent',
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
                colorScheme: 'dark',
              }}
            />
          </div>

          {/* ── 카테고리 칩 선택 ───────────────────────────
              수입/지출 전환 시 목록이 바뀌고 선택이 초기화됨
              선택된 칩은 accentColor로 강조 표시 */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              카테고리
            </label>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className="px-3 py-1.5 rounded-full text-sm font-medium transition-all active:scale-95"
                  style={{
                    backgroundColor: category === cat ? accentColor : 'var(--bg-card)',
                    color:           category === cat ? '#000'       : 'var(--text-secondary)',
                    border: `1px solid ${category === cat ? accentColor : 'var(--border)'}`,
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
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
                inputMode="numeric"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="0"
                className="w-full pl-9 pr-4 py-3 rounded-xl text-sm outline-none placeholder-gray-600"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
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

          {/* ── 메모 입력 (선택) ─────────────────────────── */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              메모{' '}
              <span style={{ color: 'var(--text-secondary)', fontWeight: 'normal' }}>(선택)</span>
            </label>
            <input
              type="text"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="예: 친구와 점심, 롯데마트"
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
            style={{ backgroundColor: accentColor, color: '#000' }}
          >
            {loading ? '저장 중...' : isEdit ? '수정 저장' : '저장'}
          </button>

        </div>
      </div>
    </div>
  );
}
