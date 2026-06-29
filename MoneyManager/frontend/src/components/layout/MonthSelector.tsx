'use client';

import { useLanguage } from '@/contexts/LanguageContext';

// ─── Props 타입 정의 ───────────────────────────────────────────
interface MonthSelectorProps {
  yearMonth: string;
  onChange: (yearMonth: string) => void;
}

// ─── 연월 이동 함수 ────────────────────────────────────────────
function addMonth(yearMonth: string, delta: number): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const date = new Date(y, m - 1 + delta, 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

// ─── MonthSelector 컴포넌트 ────────────────────────────────────
// 상단에 표시되는 연월 선택기입니다.
// 연월 표시 포맷과 이전/다음 달 버튼 aria-label이 언어에 따라 바뀝니다.
export default function MonthSelector({ yearMonth, onChange }: MonthSelectorProps) {
  const { t, formatYearMonth } = useLanguage();
  const [year, month] = yearMonth.split('-');

  return (
    <div
      className="flex items-center justify-between px-4 py-3"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <button
        onClick={() => onChange(addMonth(yearMonth, -1))}
        className="w-10 h-10 flex items-center justify-center rounded-full transition-all active:scale-95"
        style={{ color: 'var(--text-secondary)', fontSize: '24px' }}
        aria-label={t('prevMonth')}
      >
        ‹
      </button>

      <span className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
        {formatYearMonth(year, month)}
      </span>

      <button
        onClick={() => onChange(addMonth(yearMonth, 1))}
        className="w-10 h-10 flex items-center justify-center rounded-full transition-all active:scale-95"
        style={{ color: 'var(--text-secondary)', fontSize: '24px' }}
        aria-label={t('nextMonth')}
      >
        ›
      </button>
    </div>
  );
}
