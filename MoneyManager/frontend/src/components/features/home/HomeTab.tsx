'use client';

// ─── Props 타입 정의 ───────────────────────────────────────────
interface HomeTabProps {
  yearMonth: string;  // 상단 연월 선택기에서 전달받은 현재 연월 (예: "2026-06")
  refreshKey: number; // 거래 저장 완료 시 증가 → 목록 재조회 트리거로 사용 (Phase 10)
}

// ─── HomeTab 컴포넌트 ──────────────────────────────────────────
// 홈 탭 화면입니다.
// Phase 10에서 아래 기능들이 구현될 예정입니다:
//   - 선택된 연월의 거래 내역을 날짜별로 그룹화하여 목록 표시
//   - 예산 대시보드 (설정 예산 - 당월 지출 = 잔여 예산)
//   - 최신 날짜 순(DESC) 정렬
export default function HomeTab({ yearMonth, refreshKey }: HomeTabProps) {
  // refreshKey는 Phase 10 구현 시 useEffect 의존성 배열에 포함시켜
  // 거래 저장 후 자동으로 목록을 재조회하는 데 활용됩니다.
  void refreshKey;

  return (
    <div className="flex items-center justify-center h-full">
      <p style={{ color: 'var(--text-secondary)' }}>
        홈 탭 — {yearMonth} (Phase 10에서 구현)
      </p>
    </div>
  );
}
