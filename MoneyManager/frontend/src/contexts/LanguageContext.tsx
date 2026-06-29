'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { translations, DAY_NAMES, Lang, TranslationKey } from '@/i18n/translations';
import { getLanguageSetting, setLanguageSetting } from '@/lib/api';

// ─── Context 값 타입 ───────────────────────────────────────────
interface LanguageContextValue {
  language: Lang;
  // 언어를 변경하고 백엔드에 저장합니다.
  setLanguage: (lang: Lang) => void;
  // 번역 키 → 현재 언어의 번역 문자열을 반환합니다.
  t: (key: TranslationKey) => string;
  // "2026-06" 형식의 연월을 현재 언어로 포맷합니다.
  // ko: "2026년 6월" / ja: "2026年6月"
  formatYearMonth: (year: string, month: string) => string;
  // "2026-06-18" 형식의 날짜를 요일 포함 문자열로 포맷합니다.
  // ko: "6월 18일 (수)" / ja: "6月18日 (水)"
  formatDateHeader: (dateStr: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

// ─── LanguageProvider ──────────────────────────────────────────
// 앱 최상단에 배치하여 모든 자식 컴포넌트가 언어 정보를 공유합니다.
// 마운트 시 백엔드에서 저장된 언어를 불러오고,
// 언어 변경 시 즉시 UI에 반영한 뒤 백엔드에 저장합니다.
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLang] = useState<Lang>('ko');

  // 앱 시작 시 백엔드에서 저장된 언어 설정을 로드합니다.
  useEffect(() => {
    getLanguageSetting()
      .then(({ language: saved }) => {
        if (saved === 'ko' || saved === 'ja') setLang(saved);
      })
      .catch(() => {}); // 실패 시 기본값(ko) 유지
  }, []);

  // 언어 변경: 즉시 UI 갱신 + 백그라운드로 백엔드 저장
  const setLanguage = useCallback((lang: Lang) => {
    setLang(lang);
    setLanguageSetting(lang).catch(() => {}); // 저장 실패해도 UI는 유지
  }, []);

  // 번역 키 → 문자열 변환 함수
  const t = useCallback((key: TranslationKey): string => {
    return translations[language][key] as string;
  }, [language]);

  // 연월 포맷 함수
  const formatYearMonth = useCallback((year: string, month: string): string => {
    const m = Number(month);
    return language === 'ko' ? `${year}년 ${m}월` : `${year}年${m}月`;
  }, [language]);

  // 날짜 헤더 포맷 함수 (요일 포함)
  const formatDateHeader = useCallback((dateStr: string): string => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dayName = DAY_NAMES[language][new Date(y, m - 1, d).getDay()];
    return language === 'ko'
      ? `${m}월 ${d}일 (${dayName})`
      : `${m}月${d}日 (${dayName})`;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, formatYearMonth, formatDateHeader }}>
      {children}
    </LanguageContext.Provider>
  );
}

// ─── useLanguage 훅 ────────────────────────────────────────────
// 컴포넌트에서 { t, language, setLanguage, formatYearMonth, formatDateHeader }를 꺼냅니다.
export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider');
  return ctx;
}
