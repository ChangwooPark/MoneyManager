'use client';

import { useState, useEffect } from 'react';
import PinScreen from './features/auth/PinScreen';

const SESSION_KEY = 'mm_verified';

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const [verified, setVerified] = useState<boolean | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    setVerified(stored === 'true');
  }, []);

  const handleSuccess = () => {
    sessionStorage.setItem(SESSION_KEY, 'true');
    setVerified(true);
  };

  // 세션 확인 전 (깜빡임 방지)
  if (verified === null) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!verified) {
    return <PinScreen onSuccess={handleSuccess} />;
  }

  return <>{children}</>;
}
