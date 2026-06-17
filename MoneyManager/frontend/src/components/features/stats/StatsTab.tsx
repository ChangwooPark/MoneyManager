'use client';

// ─── Props 타입 정의 ───────────────────────────────────────────
interface StatsTabProps {
  yearMonth: string; // 상단 연월 선택기에서 전달받은 현재 연월 (예: "2026-06")
}

// ─── StatsTab 컴포넌트 ────────────────────────────────────────
// 통계 탭 화면입니다.
// Phase 12에서 아래 기능들이 구현될 예정입니다:
//   - 수입/지출 전환 탭
//   - 카테고리별 [내용 | 건수 | 금액] 리스트
//   - 금액 오름차순/내림차순 정렬 토글
export default function StatsTab({ yearMonth }: StatsTabProps) {
  return (
    <div className="flex items-center justify-center h-full">
      <p style={{ color: 'var(--text-secondary)' }}>
        통계 탭 — {yearMonth} (Phase 12에서 구현)
      </p>
    </div>
  );
}
