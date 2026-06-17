'use client'; // 버튼 클릭 이벤트가 필요하므로 클라이언트 컴포넌트로 선언

// ─── Props 타입 정의 ───────────────────────────────────────────
interface MonthSelectorProps {
  yearMonth: string;                   // 현재 선택된 연월 (형식: "YYYY-MM", 예: "2026-06")
  onChange: (yearMonth: string) => void; // 연월이 변경될 때 부모(MainApp)에 알리는 함수
}

// ─── 연월 계산 유틸 함수 ────────────────────────────────────────
// 주어진 연월에서 delta(+1 또는 -1)만큼 월을 이동한 결과를 반환합니다.
// Date 객체를 활용해 연도 넘김(12월 → 1월, 1월 → 12월)을 자동 처리합니다.
//
// 예시:
//   addMonth("2026-12", +1) → "2027-01"  (12월 다음달 = 다음해 1월)
//   addMonth("2026-01", -1) → "2025-12"  (1월 이전달 = 전년도 12월)
function addMonth(yearMonth: string, delta: number): string {
  const [y, m] = yearMonth.split('-').map(Number); // "2026-06" → [2026, 6]
  const date = new Date(y, m - 1 + delta, 1);      // month는 0부터 시작하므로 -1 보정
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0'); // "6" → "06" (2자리 맞춤)
  return `${year}-${month}`;
}

// ─── MonthSelector 컴포넌트 ────────────────────────────────────
// 홈·달력·통계 탭 상단에 공통으로 표시되는 연월 전환 컴포넌트입니다.
// [< 2026년 6월 >] 형태로 이전달/다음달을 전환할 수 있습니다.
export default function MonthSelector({ yearMonth, onChange }: MonthSelectorProps) {
  // "2026-06" → year="2026", month="06"
  const [year, month] = yearMonth.split('-');

  return (
    <div
      className="flex items-center justify-between px-4 py-3"
      style={{
        backgroundColor: 'var(--bg-secondary)',           // 탭바와 동일한 배경색
        borderBottom: '1px solid var(--border)',           // 아래쪽 구분선
      }}
    >
      {/* 이전 달 버튼 */}
      <button
        onClick={() => onChange(addMonth(yearMonth, -1))} // 현재 월에서 -1
        className="w-10 h-10 flex items-center justify-center rounded-full transition-all active:scale-95"
        style={{ color: 'var(--text-secondary)', fontSize: '24px' }}
        aria-label="이전 달" // 스크린리더 접근성
      >
        ‹
      </button>

      {/* 현재 연월 표시 — Number(month)로 앞의 0을 제거 ("06" → "6") */}
      <span className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
        {year}년 {Number(month)}월
      </span>

      {/* 다음 달 버튼 */}
      <button
        onClick={() => onChange(addMonth(yearMonth, 1))}  // 현재 월에서 +1
        className="w-10 h-10 flex items-center justify-center rounded-full transition-all active:scale-95"
        style={{ color: 'var(--text-secondary)', fontSize: '24px' }}
        aria-label="다음 달" // 스크린리더 접근성
      >
        ›
      </button>
    </div>
  );
}
