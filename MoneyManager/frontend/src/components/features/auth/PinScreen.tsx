'use client';

import { useState } from 'react';
import { verifyPin } from '@/lib/api';

interface PinScreenProps {
  onSuccess: () => void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

export default function PinScreen({ onSuccess }: PinScreenProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleKey = async (key: string) => {
    if (loading) return;

    if (key === '⌫') {
      setPin((p) => p.slice(0, -1));
      setError(false);
      return;
    }

    if (key === '') return;

    const next = pin + key;
    setPin(next);
    setError(false);

    if (next.length === 4) {
      setLoading(true);
      try {
        const { success } = await verifyPin(next);
        if (success) {
          onSuccess();
        } else {
          setError(true);
          setTimeout(() => { setPin(''); setError(false); }, 600);
        }
      } catch {
        setError(true);
        setTimeout(() => { setPin(''); setError(false); }, 600);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full gap-10 px-8">
      <div className="text-center">
        <p className="text-2xl font-semibold text-white mb-1">가계부</p>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          PIN 번호를 입력하세요
        </p>
      </div>

      {/* PIN 점 표시 */}
      <div className="flex gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="w-4 h-4 rounded-full border-2 transition-all duration-150"
            style={{
              borderColor: error ? 'var(--expense)' : 'var(--accent)',
              backgroundColor:
                i < pin.length
                  ? error
                    ? 'var(--expense)'
                    : 'var(--accent)'
                  : 'transparent',
            }}
          />
        ))}
      </div>

      {error && (
        <p className="text-sm -mt-6" style={{ color: 'var(--expense)' }}>
          PIN 번호가 틀렸습니다
        </p>
      )}

      {/* 숫자 패드 */}
      <div className="grid grid-cols-3 gap-4 w-full max-w-xs">
        {KEYS.map((key, idx) => (
          <button
            key={idx}
            onClick={() => handleKey(key)}
            disabled={key === '' || loading}
            className="flex items-center justify-center rounded-2xl text-xl font-medium transition-all active:scale-95"
            style={{
              height: '64px',
              backgroundColor: key === '' ? 'transparent' : 'var(--bg-card)',
              color: key === '⌫' ? 'var(--text-secondary)' : 'var(--text-primary)',
              cursor: key === '' ? 'default' : 'pointer',
            }}
          >
            {key}
          </button>
        ))}
      </div>
    </div>
  );
}
