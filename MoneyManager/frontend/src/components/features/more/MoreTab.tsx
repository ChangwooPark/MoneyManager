'use client';

// ─── MoreTab 컴포넌트 ─────────────────────────────────────────
// 더보기 탭 화면입니다.
// Phase 13에서 아래 기능들이 구현될 예정입니다:
//   - PIN 번호 변경 UI (현재 PIN 확인 → 새 PIN 설정)
//   - 월별 목표 예산 설정 UI
// 이 탭은 월별 데이터와 무관하므로 yearMonth props를 받지 않습니다.
export default function MoreTab() {
  return (
    <div className="flex items-center justify-center h-full">
      <p style={{ color: 'var(--text-secondary)' }}>
        더보기 탭 (Phase 13에서 구현)
      </p>
    </div>
  );
}
