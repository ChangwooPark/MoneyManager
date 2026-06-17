// Next.js App Router의 루트 페이지 컴포넌트입니다.
// 서버 컴포넌트로 동작하며, 클라이언트 로직은 AppShell과 MainApp에 위임합니다.
//
// 렌더링 순서:
//   page.tsx (서버) → AppShell (클라이언트, 인증 게이트)
//     ├─ 미인증: PinScreen 표시
//     └─ 인증됨: MainApp 표시 (탭바, 연월 선택기, 각 탭 컨텐츠)

import AppShell from '@/components/AppShell';
import MainApp from '@/components/MainApp';

export default function Home() {
  return (
    // AppShell: PIN 인증 게이트
    // MainApp: 인증 통과 후 표시되는 메인 화면 (탭 네비게이션 포함)
    <AppShell>
      <MainApp />
    </AppShell>
  );
}
