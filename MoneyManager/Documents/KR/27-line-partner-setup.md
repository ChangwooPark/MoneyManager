# LINE 알림 파트너 추가 설정 가이드

거래 등록 시 본인과 파트너 두 사람 모두에게 LINE 알림을 발송하기 위한 설정 방법입니다.

---

## 구조 개요

```
거래 저장
   ↓
백엔드 (Cloud Run)
   ↓ LINE Multicast API
파트너 ←─── 봇 ───→ 본인
```

파트너의 LINE User ID는 **Webhook 자동 등록** 방식으로 수집합니다.
파트너가 봇에게 메시지를 보내면 백엔드가 User ID를 Firestore에 저장하고, 이후 거래 알림이 두 사람에게 동시 발송됩니다.

---

## Step 1 — LINE Developers 콘솔: Webhook 활성화

**https://developers.line.biz** → 채널 선택 → **Messaging API** 탭

| 항목 | 설정값 |
|------|--------|
| Webhook URL | `https://money-manager-1094294666571.asia-northeast3.run.app/notifications/line-webhook` |
| Webhookの利用 (Use webhook) | **ON** |

URL 입력 후 **Verify** 버튼 클릭 → `"Success"` 확인

---

## Step 2 — LINE Official Account Manager: 자동응답 끄기

**https://manager.line.biz** → 해당 채널 선택 → **응답 설정**

| 항목 | 설정값 |
|------|--------|
| 응답 모드 | **Bot** |
| 자동응답 메시지 | **OFF** |

> **이 설정을 빠뜨리면 안 됩니다.**
> 자동응답이 켜져 있으면 파트너가 메시지를 보냈을 때 LINE 기본 메시지
> (`このアカウントでは個別のお問い合わせは受け付けておりません`)가 대신 발송되고,
> Webhook이 동작하지 않아 파트너 등록이 되지 않습니다.

---

## Step 3 — 파트너 등록 (파트너 본인이 직접)

파트너는 **LINE 개발자 계정 없이** 일반 LINE 앱만으로 등록할 수 있습니다.

### 봇 공유 방법
LINE Developers 콘솔 → Messaging API 탭에서 **QR 코드** 또는 **봇 ID (@로 시작)** 를 파트너에게 전달합니다.

### 파트너 등록 절차
1. 파트너가 LINE 앱에서 봇을 **친구 추가**
2. 봇에게 **아무 메시지나 전송** (예: "등록해줘", "안녕")
3. 봇이 자동으로 회신:
   ```
   ✅ 알림 수신자로 등록되었습니다!
   User ID: Uxxxxxxxxxxxxxxxxx
   ```

---

## Step 4 — 등록 확인

앱 → **더보기** → **LINE 알림** 섹션을 열면 수신자 목록에 **2명**이 표시됩니다.

이후 거래를 등록할 때마다 두 사람 모두에게 알림이 발송됩니다.

---

## 트러블슈팅

| 증상 | 원인 | 해결 방법 |
|------|------|-----------|
| `このアカウントでは...` 메시지가 옴 | 자동응답이 켜져 있음 | Step 2 — 자동응답 OFF |
| Verify 실패 | Webhook URL 오타 또는 Cloud Run 미배포 | URL 재확인, `git push`로 배포 확인 |
| 등록 후에도 알림 미수신 | LINE 알림 토글이 OFF 상태 | 더보기 → LINE 알림 → 토글 ON 확인 |
| 수신자 목록에 1명만 표시 | 파트너 등록 미완료 | Step 3 재시도 |

---

## 수신자 삭제 방법

앱 → **더보기** → **LINE 알림** 섹션 → 수신자 목록 → **삭제** 버튼
