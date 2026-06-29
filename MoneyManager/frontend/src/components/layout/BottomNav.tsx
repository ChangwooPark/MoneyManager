'use client';

import { TabType } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';

// ─── Props 타입 정의 ───────────────────────────────────────────
interface BottomNavProps {
  activeTab: TabType;
  onChange: (tab: TabType) => void;
}

// ─── BottomNav 컴포넌트 ────────────────────────────────────────
// 화면 최하단에 항상 고정되는 탭 네비게이션 바입니다.
// 탭 레이블은 LanguageContext의 t()로 현재 언어에 따라 번역됩니다.
export default function BottomNav({ activeTab, onChange }: BottomNavProps) {
  const { t } = useLanguage();

  // id와 번역 키를 매핑 — 레이블은 t()로 런타임에 결정됩니다.
  const TABS: { id: TabType; labelKey: 'navHome' | 'navCalendar' | 'navStats' | 'navMore'; icon: string }[] = [
    { id: 'home',     labelKey: 'navHome',     icon: '🏠' },
    { id: 'calendar', labelKey: 'navCalendar', icon: '📅' },
    { id: 'stats',    labelKey: 'navStats',    icon: '📊' },
    { id: 'more',     labelKey: 'navMore',     icon: '⋯' },
  ];

  return (
    <nav
      className="flex items-center border-t"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        borderColor: 'var(--border)',
        height: '64px',
        flexShrink: 0,
      }}
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className="flex flex-col items-center justify-center gap-1 flex-1 h-full transition-all active:scale-95"
            style={{ color: isActive ? 'var(--accent)' : 'var(--text-secondary)' }}
          >
            <span className="text-xl leading-none">{tab.icon}</span>
            <span className="text-xs font-medium">{t(tab.labelKey)}</span>
          </button>
        );
      })}
    </nav>
  );
}
