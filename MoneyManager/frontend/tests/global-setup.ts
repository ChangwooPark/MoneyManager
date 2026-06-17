// ─── Playwright 전역 셋업 ──────────────────────────────────────
// 모든 테스트가 시작되기 전에 단 한 번 실행됩니다.
//
// 목적: Firestore 콜드 스타트 방지
//   백엔드 /health 엔드포인트는 Firestore를 사용하지 않습니다.
//   따라서 Playwright가 "백엔드 준비 완료"로 판단해도,
//   실제 Firestore 첫 요청은 콜드 스타트로 수 초가 걸릴 수 있습니다.
//
//   이 셋업에서 Firestore가 필요한 API를 미리 한 번 호출하면
//   이후 테스트는 워밍업된 연결을 재사용해 정상 속도로 응답합니다.

async function globalSetup() {
  const BACKEND_URL = 'http://localhost:8080';
  const MAX_RETRIES = 5;
  const RETRY_DELAY_MS = 2000;

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      // PIN 검증 API 호출 — Firestore 연결을 미리 초기화
      // 의도적으로 틀린 PIN을 사용해 데이터 변경 없이 연결만 워밍업
      const res = await fetch(`${BACKEND_URL}/settings/pin/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: '0000' }),
      });

      if (res.ok) {
        console.log('[global-setup] 백엔드 Firestore 워밍업 완료');
        return; // 성공 시 종료
      }
    } catch {
      // 백엔드가 아직 시작 중이면 재시도
      console.log(`[global-setup] 백엔드 연결 대기 중... (${i + 1}/${MAX_RETRIES})`);
    }

    // 재시도 전 대기
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
  }

  console.warn('[global-setup] 백엔드 워밍업 실패 — 테스트 타임아웃이 발생할 수 있습니다.');
}

export default globalSetup;
