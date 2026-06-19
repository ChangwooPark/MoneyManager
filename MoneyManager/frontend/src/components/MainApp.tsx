'use client'; // useState로 탭/연월 상태를 관리하므로 클라이언트 컴포넌트로 선언

import { useState } from 'react';
import { TabType } from '@/types';
import BottomNav from './layout/BottomNav';
import MonthSelector from './layout/MonthSelector';
import HomeTab from './features/home/HomeTab';
import CalendarTab from './features/calendar/CalendarTab';
import StatsTab from './features/stats/StatsTab';
import MoreTab from './features/more/MoreTab';
import TransactionForm from './features/transaction/TransactionForm';

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

  // 거래 입력 폼 표시 여부 상태
  // true이면 TransactionForm 바텀시트가 화면에 표시됨
  const [showForm, setShowForm] = useState(false);

  // 거래 목록 강제 갱신을 위한 카운터
  // 저장 성공 시 +1 → HomeTab이 이 값을 의존성으로 받으면 자동으로 목록 재조회
  const [refreshKey, setRefreshKey] = useState(0);

  // 현재 탭이 연월 선택기를 표시해야 하는 탭인지 여부
  const showMonthSelector = TABS_WITH_MONTH_SELECTOR.includes(activeTab);

  // 저장 완료 후 호출 — 목록 갱신 트리거
  const handleSaved = () => setRefreshKey((k) => k + 1);

  return (
    // h-full: 부모(body)의 전체 높이를 채움
    // flex flex-col: 상단 선택기 / 중간 컨텐츠 / 하단 탭바를 세로로 배치
    // relative: FAB 버튼을 이 컨테이너 기준으로 절대 위치 지정하기 위해 필요
    <div className="flex flex-col h-full relative" style={{ backgroundColor: 'var(--bg-primary)' }}>

      {/* 상단 연월 선택기 — 더보기 탭에서는 렌더링 자체를 생략 */}
      {showMonthSelector && (
        <MonthSelector yearMonth={yearMonth} onChange={setYearMonth} />
      )}

      {/* 탭 컨텐츠 영역
          flex-1: 남은 세로 공간을 모두 차지
          overflow-y-auto: 내용이 길면 세로 스크롤 활성화
          overflow-hidden: 거래 입력 모달이 열려 있는 동안 배경 스크롤 차단
          flex flex-col: 자식 탭이 flex-1 로 높이를 채울 수 있도록 flex 컨텍스트 제공
                         (CalendarTab은 flex-1 으로 전체 높이를 채우고,
                          HomeTab·StatsTab은 자연 높이를 가져 overflow 시 스크롤됨) */}
      <main className={`flex-1 flex flex-col ${showForm ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        {/* 조건부 렌더링: 활성 탭에 해당하는 컴포넌트만 표시
            yearMonth를 props로 전달해 각 탭이 해당 월 데이터를 조회할 수 있게 함
            refreshKey: 저장 완료 시 변경되어 각 탭의 데이터를 재조회하게 함 */}
        {activeTab === 'home'     && <HomeTab     yearMonth={yearMonth} refreshKey={refreshKey} />}
        {activeTab === 'calendar' && <CalendarTab yearMonth={yearMonth} refreshKey={refreshKey} />}
        {activeTab === 'stats'    && <StatsTab    yearMonth={yearMonth} refreshKey={refreshKey} />}
        {activeTab === 'more'     && <MoreTab />}
      </main>

      {/* ── FAB (Floating Action Button) ─────────────────────────────
          화면 우하단에 고정된 '+' 버튼입니다.
          더보기 탭에서는 불필요하므로 숨깁니다.
          bottom-20: 탭바(64px) 위에 여유를 두고 배치
          z-40: 탭바(z-index 미설정)보다 위에, 폼 오버레이(z-50)보다 아래
      */}
      {activeTab !== 'more' && (
        <button
          onClick={() => setShowForm(true)}
          className="absolute bottom-20 right-4 w-14 h-14 rounded-full flex items-center justify-center text-2xl font-light shadow-lg active:scale-95 transition-transform z-40"
          style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
          aria-label="거래 추가"
        >
          +
        </button>
      )}

      {/* 하단 탭바 — flex-col 구조에서 항상 맨 아래에 위치
          BottomNav 내부에서 flexShrink:0 으로 높이 고정 */}
      <BottomNav activeTab={activeTab} onChange={setActiveTab} />

      {/* 거래 입력 폼 — showForm이 true일 때만 렌더링
          onClose: 폼 닫기, onSaved: 저장 완료 후 목록 갱신 */}
      {showForm && (
        <TransactionForm
          onClose={() => setShowForm(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
