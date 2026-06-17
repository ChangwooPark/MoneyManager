'use client';

// ─── Props 타입 정의 ───────────────────────────────────────────
interface CalendarTabProps {
  yearMonth: string; // 상단 연월 선택기에서 전달받은 현재 연월 (예: "2026-06")
}

// ─── CalendarTab 컴포넌트 ─────────────────────────────────────
// 달력 탭 화면입니다.
// Phase 11에서 아래 기능들이 구현될 예정입니다:
//   - 월간 그리드 달력 (7열)
//   - 각 날짜에 수입/지출 합계 금액 표시
//   - 날짜 클릭 시 해당 날짜 상세 내역 팝업(Bottom Sheet)
export default function CalendarTab({ yearMonth }: CalendarTabProps) {
  return (
    <div className="flex items-center justify-center h-full">
      <p style={{ color: 'var(--text-secondary)' }}>
        달력 탭 — {yearMonth} (Phase 11에서 구현)
      </p>
    </div>
  );
}
