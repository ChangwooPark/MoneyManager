# 트러블슈팅: 프로덕션 PIN 인증 실패

## 현상

로컬 환경에서는 PIN `8907`이 정상 동작하는데,  
Vercel 프로덕션 URL에서는 같은 PIN을 입력해도 "PIN 번호가 틀렸습니다"가 표시되며 로그인이 안 되는 문제.

---

## 분석 과정

### 1단계: 백엔드가 문제인가?

가장 먼저 백엔드 API가 올바르게 응답하는지 `curl`로 직접 테스트했습니다.

```bash
curl -X POST \
  https://money-manager-1094294666571.asia-northeast3.run.app/settings/pin/verify \
  -H "Content-Type: application/json" \
  -H "Origin: https://frontend-dusky-tau-46.vercel.app" \
  -d '{"pin":"8907"}'

# 응답:
{"success":true}
```

**결론:** 백엔드는 정상입니다. `8907`에 대해 `success: true`를 반환합니다.

---

### 2단계: 프론트엔드 코드가 문제인가?

`PinScreen.tsx`의 에러 처리 코드를 확인했습니다.

```typescript
try {
  const { success } = await verifyPin(next);
  if (success) {
    onSuccess();        // 인증 성공
  } else {
    setError(true);     // ← 백엔드가 false 반환 시 이 경로
    setTimeout(() => { setPin(''); setError(false); }, 600);
  }
} catch {
  setError(true);       // ← fetch 자체가 실패해도 이 경로 (같은 UI)
  setTimeout(() => { setPin(''); setError(false); }, 600);
}
```

**핵심 발견:** `success: false`를 받았을 때와 `fetch 자체가 실패했을 때` 화면에 표시되는 오류 메시지가 동일합니다.  
즉, "PIN 번호가 틀렸습니다"는 실제로 PIN이 틀린 게 아니라 **네트워크 오류일 수도 있습니다.**

---

### 3단계: 환경변수가 올바르게 설정되어 있는가?

Vercel에 저장된 환경변수 목록을 확인했습니다.

```bash
vercel env ls production

# 결과:
# name                  value       environments   created
# NEXT_PUBLIC_API_URL   Encrypted   Production     1h ago
```

환경변수는 존재합니다. 그런데 값이 **Encrypted(암호화)** 로 표시되고 있습니다.

---

### 4단계: GitHub Actions에서 환경변수가 올바르게 내려오는가?

`vercel pull`이 실제로 다운로드하는 값을 직접 확인했습니다.

```bash
vercel env pull .env.verify --environment=production --yes
cat .env.verify
```

```dotenv
# 결과:
NEXT_PUBLIC_API_URL=""       ← 빈 문자열!
VERCEL="1"
VERCEL_ENV="production"
...
```

**원인 발견:** `NEXT_PUBLIC_API_URL`이 빈 문자열(`""`)로 내려오고 있었습니다.

---

## 근본 원인

### Vercel 암호화 변수의 동작 방식

Vercel은 환경변수를 두 가지 타입으로 저장합니다.

| 타입 | 설명 | vercel pull 결과 |
|------|------|-----------------|
| 일반(Plain) | 평문으로 저장 | 실제 값이 다운로드됨 |
| 암호화(Sensitive/Encrypted) | 암호화하여 저장 | **빈 문자열(`""`)로 다운로드됨** |

`NEXT_PUBLIC_API_URL`이 암호화 타입으로 저장되어 있었기 때문에,  
GitHub Actions의 `vercel pull` 단계에서 실제 URL 대신 빈 문자열을 받아왔습니다.

### 빌드 과정에서의 연쇄 문제

```
vercel pull → NEXT_PUBLIC_API_URL = ""
     ↓
vercel build → next build 실행
     ↓
api.ts: const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'
        "" ?? 'http://localhost:8080' = ""   ← ?? 는 null/undefined만 감지, 빈 문자열은 통과!
     ↓
BASE_URL = ""  (빈 문자열)
     ↓
fetch(`${BASE_URL}/settings/pin/verify`) = fetch("/settings/pin/verify")
     ↓
Vercel 서버에서 /settings/pin/verify 경로를 찾음 → 없음 → 404 에러
     ↓
catch 블록 실행 → "PIN 번호가 틀렸습니다" 표시
```

### `??` 와 `||` 의 차이

이 문제의 핵심이 된 JavaScript 연산자 차이입니다.

```javascript
// Nullish Coalescing (??) — null과 undefined만 감지
"" ?? "기본값"   // = ""        ← 빈 문자열은 그대로 통과!
null ?? "기본값" // = "기본값"
undefined ?? "기본값" // = "기본값"

// OR (||) — falsy 값 전체 감지 (null, undefined, "", 0, false)
"" || "기본값"   // = "기본값"  ← 빈 문자열도 기본값으로 대체
null || "기본값" // = "기본값"
undefined || "기본값" // = "기본값"
```

`NEXT_PUBLIC_API_URL`이 `""`(빈 문자열)일 때 `??`는 그냥 통과시켜버렸고,  
그 결과 `BASE_URL`이 빈 문자열이 되었습니다.

---

## 해결 방법

### 수정 1: `api.ts` — `??` → `||` 변경

```typescript
// 수정 전
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

// 수정 후
// || 사용: 빈 문자열("")도 폴백으로 처리
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
```

이것만으로도 빈 문자열 문제를 방어할 수 있습니다.  
하지만 근본적인 원인(환경변수가 빈 값으로 오는 것)도 함께 수정했습니다.

---

### 수정 2: GitHub Actions 워크플로우 — 빌드 시 환경변수 직접 주입

```yaml
- name: Build project
  working-directory: MoneyManager/frontend
  run: vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}
  env:
    VERCEL_ORG_ID: team_C6F9p19SH8pOyJxy7x8OtS82
    VERCEL_PROJECT_ID: prj_5TOJOfymglx2pWt2aQXTDc0B909g
    NEXT_PUBLIC_API_URL: https://money-manager-1094294666571.asia-northeast3.run.app  # ← 추가
```

`vercel build`를 실행하는 환경에 직접 `NEXT_PUBLIC_API_URL`을 주입합니다.  
시스템 환경변수는 `vercel pull`로 받은 값보다 우선 적용되므로,  
암호화 변수 문제와 무관하게 항상 올바른 URL로 빌드됩니다.

> **왜 하드코딩해도 괜찮은가?**  
> `NEXT_PUBLIC_API_URL`은 Cloud Run 백엔드의 공개 URL입니다.  
> 비밀 정보(Secret)가 아니므로 워크플로우 파일에 직접 작성해도 보안상 문제가 없습니다.

---

## 최종 수정된 흐름

```
git push origin main
     ↓
GitHub Actions 실행
     ↓
vercel pull → NEXT_PUBLIC_API_URL = "" (여전히 빈 값)
     ↓
vercel build (환경변수 NEXT_PUBLIC_API_URL=https://...run.app 을 직접 주입)
     ↓
next build → process.env.NEXT_PUBLIC_API_URL = "https://...run.app"  ✅
     ↓
BASE_URL = "https://money-manager-1094294666571.asia-northeast3.run.app"
     ↓
fetch("https://...run.app/settings/pin/verify")  ✅
     ↓
{"success": true}  ✅
     ↓
PIN 인증 성공  ✅
```

---

## 배운 점 정리

### 1. 오류 메시지만 보면 안 된다

"PIN이 틀렸습니다"라는 UI 메시지는 실제로 두 가지 원인이 있었습니다.
- 실제로 PIN이 틀린 경우
- **네트워크/API 오류로 fetch가 실패한 경우**

이처럼 같은 UI 메시지가 다른 원인에서 발생할 수 있으므로,  
**백엔드를 직접 테스트(curl)** 해서 의심 범위를 좁히는 것이 중요합니다.

### 2. 환경변수는 배포 방법에 따라 동작이 달라진다

| 배포 방법 | 환경변수 처리 방식 |
|-----------|-----------------|
| `vercel --prod` (CLI 직접 실행) | Vercel 서버가 직접 빌드하므로 암호화 변수도 정상 사용 |
| GitHub Actions + `vercel pull/build/deploy` | `vercel pull`이 암호화 변수를 빈 값으로 반환 |

기존에는 CLI로 직접 배포했기 때문에 문제가 없었지만,  
GitHub Actions 방식으로 전환하면서 이 차이가 드러났습니다.

### 3. `??` 와 `||` 는 용도가 다르다

환경변수처럼 "설정되지 않았거나 비어있을 수 있는" 값에는 `||`를 사용하는 것이 안전합니다.  
`??`는 `null`/`undefined`만 감지하므로 빈 문자열 상황에서는 동작하지 않습니다.

---

## 관련 파일

| 파일 | 수정 내용 |
|------|----------|
| `frontend/src/lib/api.ts` | `??` → `||` 변경 |
| `.github/workflows/deploy.yml` | `vercel build` 단계에 `NEXT_PUBLIC_API_URL` 직접 주입 |
