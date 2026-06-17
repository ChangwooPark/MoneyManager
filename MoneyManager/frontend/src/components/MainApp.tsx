'use client'; // useState로 탭/연월 상태를 관리하므로 클라이언트 컴포넌트로 선언

import { useState } from 'react';
import { TabType } from '@/types';
import BottomNav from './layout/BottomNav';
import MonthSelector from './layout/MonthSelector';
import HomeTab from './features/home/HomeTab';
import CalendarTab from './features/calendar/CalendarTab';
import StatsTab from './features/stats/StatsTab';
import MoreTab from './features/more/MoreTab';

// ─── 현재 연월 계산 함수 ────────────────────────────────────────
// 앱 최초 실행 시 오늘 날짜 기준의 연월을 기본값으로 사용합니다.
// 결과 예시: "2026-06"
function getCurrentYearMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0'); // "6" → "06"
  return `${y}-${m}`;
}

// ─── 연월 선택기를 표시할 탭 목록 ──────────────────────────────
// '더보기' 탭은 월별 데이터와 무관하므로 연월 선택기를 표시하지 않습니다.
const TABS_WITH_MONTH_SELECTOR: TabType[] = ['home', 'calendar', 'stats'];

// ─── MainApp 컴포넌트 ──────────────────────────────────────────
// PIN 인증 통과 후 표시되는 메인 화면입니다.
// 탭 상태(activeTab)와 연월 상태(yearMonth)를 한 곳에서 관리하고,
// 각 자식 컴포넌트에 props로 전달합니다.
//
// 전체 레이아웃 구조:
//   ┌─────────────────┐
//   │   MonthSelector  │ ← 홈/달력/통계 탭에서만 표시
//   ├─────────────────┤
//   │                 │
//   │   탭 컨텐츠     │ ← 스크롤 가능 영역
//   │                 │
//   ├─────────────────┤
//   │    BottomNav    │ ← 항상 하단 고정
//   └─────────────────┘
export default function MainApp() {
  // 현재 활성화된 탭 상태 (기본값: 홈 탭)
  const [activeTab, setActiveTab] = useState<TabType>('home');

  // 현재 선택된 연월 상태 (기본값: 오늘 기준 연월)
  const [yearMonth, setYearMonth] = useState(getCurrentYearMonth());

  // 현재 탭이 연월 선택기를 표시해야 하는 탭인지 여부
  const showMonthSelector = TABS_WITH_MONTH_SELECTOR.includes(activeTab);

  return (
    // h-full: 부모(body)의 전체 높이를 채움
    // flex flex-col: 상단 선택기 / 중간 컨텐츠 / 하단 탭바를 세로로 배치
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--bg-primary)' }}>

      {/* 상단 연월 선택기 — 더보기 탭에서는 렌더링 자체를 생략 */}
      {showMonthSelector && (
        <MonthSelector yearMonth={yearMonth} onChange={setYearMonth} />
      )}

      {/* 탭 컨텐츠 영역
          flex-1: 남은 세로 공간을 모두 차지 (위 선택기 + 아래 탭바를 제외한 영역)
          overflow-y-auto: 내용이 길면 세로 스크롤 활성화 */}
      <main className="flex-1 overflow-y-auto">
        {/* 조건부 렌더링: 활성 탭에 해당하는 컴포넌트만 표시
            yearMonth를 props로 전달해 각 탭이 해당 월 데이터를 조회할 수 있게 함 */}
        {activeTab === 'home'     && <HomeTab     yearMonth={yearMonth} />}
        {activeTab === 'calendar' && <CalendarTab yearMonth={yearMonth} />}
        {activeTab === 'stats'    && <StatsTab    yearMonth={yearMonth} />}
        {activeTab === 'more'     && <MoreTab />}
      </main>

      {/* 하단 탭바 — flex-col 구조에서 항상 맨 아래에 위치
          BottomNav 내부에서 flexShrink:0 으로 높이 고정 */}
      <BottomNav activeTab={activeTab} onChange={setActiveTab} />
    </div>
  );
}
