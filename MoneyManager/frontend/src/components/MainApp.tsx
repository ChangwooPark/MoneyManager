'use client';

import { useState } from 'react';
import { TabType, Transaction } from '@/types';
import BottomNav from './layout/BottomNav';
import MonthSelector from './layout/MonthSelector';
import HomeTab from './features/home/HomeTab';
import CalendarTab from './features/calendar/CalendarTab';
import StatsTab from './features/stats/StatsTab';
import MoreTab from './features/more/MoreTab';
import TransactionForm from './features/transaction/TransactionForm';

function getCurrentYearMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

const TABS_WITH_MONTH_SELECTOR: TabType[] = ['home', 'calendar', 'stats'];

export default function MainApp() {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [yearMonth, setYearMonth] = useState(getCurrentYearMonth());

  // FAB로 열리는 추가 폼
  const [showForm, setShowForm] = useState(false);

  // 홈 탭에서 거래 항목 클릭 → 수정 폼 (initialData 주입)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  // 저장/삭제/초기화 완료 시 +1 → 각 탭이 이 값을 의존성으로 데이터 재조회
  const [refreshKey, setRefreshKey] = useState(0);

  const showMonthSelector = TABS_WITH_MONTH_SELECTOR.includes(activeTab);
  const handleSaved = () => setRefreshKey(k => k + 1);

  // 추가 폼 또는 수정 폼이 열려 있을 때 배경 스크롤 차단
  const hasModal = showForm || !!editingTx;

  return (
    <div className="flex flex-col h-full relative" style={{ backgroundColor: 'var(--bg-primary)' }}>

      {showMonthSelector && (
        <MonthSelector yearMonth={yearMonth} onChange={setYearMonth} />
      )}

      {/* 탭 컨텐츠 영역
          hasModal 시 overflow-hidden으로 배경 스크롤 차단 (iOS는 TransactionForm 내 touchmove 방어) */}
      <main className={`flex-1 flex flex-col ${hasModal ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        {activeTab === 'home' && (
          <HomeTab
            yearMonth={yearMonth}
            refreshKey={refreshKey}
            onRefresh={handleSaved}
            onEdit={setEditingTx}
          />
        )}
        {activeTab === 'calendar' && (
          <CalendarTab
            yearMonth={yearMonth}
            refreshKey={refreshKey}
            onEdit={setEditingTx}
            onRefresh={handleSaved}
          />
        )}
        {activeTab === 'stats' && (
          <StatsTab
            yearMonth={yearMonth}
            refreshKey={refreshKey}
            onEdit={setEditingTx}
            onRefresh={handleSaved}
          />
        )}
        {activeTab === 'more'     && <MoreTab onReset={handleSaved} />}
      </main>

      {/* FAB — 더보기 탭에서는 숨김 */}
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

      <BottomNav activeTab={activeTab} onChange={setActiveTab} />

      {/* 거래 추가 폼 (FAB) */}
      {showForm && (
        <TransactionForm
          onClose={() => setShowForm(false)}
          onSaved={handleSaved}
        />
      )}

      {/* 거래 수정 폼 (홈 탭 항목 클릭 → 상세 → 수정) */}
      {editingTx && (
        <TransactionForm
          initialData={editingTx}
          onClose={() => setEditingTx(null)}
          onSaved={() => { setEditingTx(null); handleSaved(); }}
        />
      )}
    </div>
  );
}
