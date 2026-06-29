'use client'; // useState, useEffect, sessionStorage 사용을 위해 클라이언트 컴포넌트로 선언

import { useState, useEffect } from 'react';
import PinScreen from './features/auth/PinScreen';
import { LanguageProvider } from '@/contexts/LanguageContext';

// ─── 세션 스토리지 키 상수 ─────────────────────────────────────
// 브라우저 sessionStorage에 인증 완료 여부를 저장할 때 사용하는 키 이름입니다.
// 상수로 관리해 오타를 방지합니다.
const SESSION_KEY = 'mm_verified';

// ─── Props 타입 정의 ───────────────────────────────────────────
interface AppShellProps {
  children: React.ReactNode; // 인증 성공 후 표시할 메인 화면 (MainApp)
}

// ─── AppShell 컴포넌트 ────────────────────────────────────────
// 앱 전체를 감싸는 인증 게이트 역할을 합니다.
// 인증 여부에 따라 PIN 화면 또는 메인 화면을 렌더링합니다.
//
// 상태 흐름:
//   null    → 로딩 중 (sessionStorage 확인 전, 서버 렌더링 시)
//   false   → 미인증 → PinScreen 표시
//   true    → 인증 완료 → children(MainApp) 표시
//
// null 상태가 필요한 이유:
//   Next.js는 서버에서 먼저 렌더링하는데, 서버에는 sessionStorage가 없습니다.
//   boolean으로만 관리하면 서버에서 항상 "미인증"으로 렌더링되어
//   클라이언트에서 다시 "인증됨"으로 바뀔 때 화면이 깜빡입니다.
//   null을 중간 상태로 두어 클라이언트 확인 전까지 스피너를 표시합니다.
//
// LanguageProvider를 AppShell 안에 배치하여 앱 전체(PIN 화면 포함)에서
// useLanguage() 훅을 사용할 수 있게 합니다.
export default function AppShell({ children }: AppShellProps) {
  // null: 아직 확인 안 됨 / false: 미인증 / true: 인증 완료
  const [verified, setVerified] = useState<boolean | null>(null);

  // 컴포넌트가 브라우저에 마운트된 후 sessionStorage를 확인합니다.
  // useEffect는 클라이언트에서만 실행되므로 sessionStorage 접근이 안전합니다.
  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    setVerified(stored === 'true'); // 저장된 값이 정확히 'true'일 때만 인증 처리
  }, []); // 빈 배열: 컴포넌트 최초 마운트 시 1회만 실행

  // ── 인증 성공 콜백 ──────────────────────────────────────────
  // PinScreen에서 PIN 검증 성공 시 호출됩니다.
  // sessionStorage에 인증 기록을 저장하고 메인 화면으로 전환합니다.
  const handleSuccess = () => {
    sessionStorage.setItem(SESSION_KEY, 'true'); // 탭이 열려있는 동안 유지
    setVerified(true);
  };

  return (
    <LanguageProvider>
      {/* ── 로딩 중 (sessionStorage 확인 전) ────────────────────
          스피너를 표시해 화면 깜빡임(Flash of Unauthenticated Content)을 방지합니다. */}
      {verified === null && (
        <div className="flex items-center justify-center h-full">
          {/* 회전 애니메이션: border-t를 투명하게 해서 한쪽이 뚫린 원처럼 보이게 함 */}
          <div
            className="w-6 h-6 rounded-full border-2 animate-spin"
            style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
          />
        </div>
      )}

      {/* ── 미인증 상태: PIN 입력 화면 ─────────────────────────── */}
      {verified === false && <PinScreen onSuccess={handleSuccess} />}

      {/* ── 인증 완료 상태: MainApp ──────────────────────────────
          children으로 전달된 MainApp을 그대로 렌더링합니다. */}
      {verified === true && children}
    </LanguageProvider>
  );
}
