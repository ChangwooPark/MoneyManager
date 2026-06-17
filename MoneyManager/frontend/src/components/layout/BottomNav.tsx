'use client'; // 버튼 클릭 이벤트가 필요하므로 클라이언트 컴포넌트로 선언

import { TabType } from '@/types'; // 탭 종류를 나타내는 타입 ('home' | 'calendar' | 'stats' | 'more')

// ─── Props 타입 정의 ───────────────────────────────────────────
interface BottomNavProps {
  activeTab: TabType;               // 현재 활성화된 탭
  onChange: (tab: TabType) => void; // 탭이 변경될 때 부모(MainApp)에 알리는 함수
}

// ─── 탭 목록 정의 ─────────────────────────────────────────────
// id: 탭 식별자 (TabType과 일치해야 함)
// label: 화면에 표시될 한국어 이름
// icon: 탭 아이콘 (이모지 사용)
const TABS: { id: TabType; label: string; icon: string }[] = [
  { id: 'home',     label: '홈',    icon: '🏠' },
  { id: 'calendar', label: '달력',  icon: '📅' },
  { id: 'stats',    label: '통계',  icon: '📊' },
  { id: 'more',     label: '더보기', icon: '⋯' },
];

// ─── BottomNav 컴포넌트 ────────────────────────────────────────
// 화면 최하단에 항상 고정되는 탭 네비게이션 바입니다.
// 각 탭 버튼을 누르면 onChange 콜백을 통해 부모에게 탭 변경을 알립니다.
export default function BottomNav({ activeTab, onChange }: BottomNavProps) {
  return (
    // nav: 시맨틱 HTML — 내비게이션 영역임을 브라우저/스크린리더에 알림
    // flexShrink: 0 — 콘텐츠 영역이 늘어나도 탭바 높이가 줄어들지 않도록 고정
    <nav
      className="flex items-center border-t"
      style={{
        backgroundColor: 'var(--bg-secondary)', // 약간 밝은 배경으로 탭바 구분
        borderColor: 'var(--border)',            // 위쪽 구분선
        height: '64px',                          // 터치 타깃 확보 (최소 44px 이상)
        flexShrink: 0,                           // 높이 고정 (줄어들지 않음)
      }}
    >
      {/* 탭 목록을 순회하며 각 탭 버튼 렌더링 */}
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id; // 현재 탭이 활성화된 탭인지 여부

        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)} // 클릭 시 부모에게 탭 변경 알림
            // flex-1: 탭 버튼이 가로 공간을 균등하게 나눠 가짐
            // active:scale-95: 누를 때 살짝 작아지는 터치 피드백
            className="flex flex-col items-center justify-center gap-1 flex-1 h-full transition-all active:scale-95"
            style={{
              // 활성 탭은 강조색(보라), 비활성 탭은 회색으로 표시
              color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
            }}
          >
            {/* 아이콘 */}
            <span className="text-xl leading-none">{tab.icon}</span>
            {/* 탭 이름 */}
            <span className="text-xs font-medium">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
