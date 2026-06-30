// ─── 지원 언어 타입 ────────────────────────────────────────────
export type Lang = 'ko' | 'ja';

// ─── 요일 이름 (언어별) ────────────────────────────────────────
// CalendarTab · HomeTab · TransactionDetailSheet에서 날짜 포맷 시 사용합니다.
export const DAY_NAMES: Record<Lang, readonly string[]> = {
  ko: ['일', '월', '화', '수', '목', '금', '토'],
  ja: ['日', '月', '火', '水', '木', '金', '土'],
};

// ─── UI 문자열 번역 맵 ─────────────────────────────────────────
// 모든 한국어 하드코딩 문자열을 ko/ja 두 묶음으로 정의합니다.
// 카테고리 이름(식비, 교통 등)은 Firestore 사용자 데이터이므로 번역 대상 외입니다.
export const translations = {
  ko: {
    // ── 공통 ──────────────────────────────────────────────────
    loading:   '불러오는 중...',
    loadError: '데이터를 불러오는 데 실패했습니다.',
    cancel:    '취소',
    close:     '닫기',
    income:    '수입',
    expense:   '지출',

    // ── 하단 탭바 ─────────────────────────────────────────────
    navHome:     '홈',
    navCalendar: '달력',
    navStats:    '통계',
    navMore:     '더보기',

    // ── 연월 선택기 ───────────────────────────────────────────
    prevMonth: '이전 달',
    nextMonth: '다음 달',

    // ── 홈 탭 ─────────────────────────────────────────────────
    budget:              '예산',
    budgetNotSet:        '미설정',
    remaining:           '잔여',
    spent:               '% 소진',
    over:                '초과',
    monthlyIncome:       '이번 달 수입',
    noTransactions:      '이번 달 거래 내역이 없습니다.',
    noTransactionsHint:  '+ 버튼을 눌러 첫 번째 내역을 추가해 보세요.',

    // ── 달력 탭 ───────────────────────────────────────────────
    noTxOnDay: '이날의 거래 내역이 없습니다.',

    // ── 통계 탭 ───────────────────────────────────────────────
    noIncomeStats:  '이번 달 수입 내역이 없습니다.',
    noExpenseStats: '이번 달 지출 내역이 없습니다.',
    statsTotalLabel:   '총',
    statsCountUnit:    '건',
    statsColContent:   '내용',
    statsColCount:     '건수',
    statsColAmount:    '금액',
    statsNoTx:         '거래 내역이 없습니다.',

    // ── 영수증 스캔 ───────────────────────────────────────────
    receiptScanBtn:     '영수증 스캔',
    receiptScanning:    '분석 중...',
    receiptScanError:   '영수증 인식에 실패했습니다.',
    receiptScanFilled:  '영수증에서 자동 입력됐습니다. 내용을 확인해 주세요.',

    // ── 거래 입력 폼 ──────────────────────────────────────────
    formTitleAdd:       '내역 추가',
    formTitleEdit:      '내역 수정',
    formDate:           '날짜',
    formCategory:       '카테고리',
    formAmount:         '금액',
    formMemo:           '메모',
    formMemoOpt:        '(선택)',
    formMemoPlaceholder:'예: 친구와 점심, 롯데마트',
    formSave:           '저장',
    formSaveEdit:       '수정 저장',
    formSaving:         '저장 중...',
    errCategory:        '카테고리를 선택해 주세요',
    errAmount:          '금액을 입력해 주세요',
    errSave:            '저장에 실패했습니다. 다시 시도해 주세요.',

    // ── 거래 상세 시트 ────────────────────────────────────────
    txDetail:        '거래 상세',
    txDate:          '날짜',
    txType:          '유형',
    txCategory:      '카테고리',
    txAmount:        '금액',
    txMemo:          '메모',
    txEdit:          '수정',
    txDelete:        '삭제',
    txDeleteConfirm: '거래를 삭제하시겠습니까?',
    txDeleting:      '삭제 중...',
    txDeleteError:   '삭제에 실패했습니다. 다시 시도해 주세요.',
    txDeleteCancel:  '취소',

    // ── 더보기 탭 — 공통 ──────────────────────────────────────
    moreCurrent: '현재',

    // ── 더보기 — PIN 변경 ─────────────────────────────────────
    morePin:          'PIN 번호 변경',
    morePinCurrent:   '현재 PIN',
    morePinNew:       '새 PIN',
    morePinConfirm:   '새 PIN 확인',
    morePinSave:      '변경 저장',
    morePinSuccess:   'PIN이 변경되었습니다 ✓',
    morePinErrCurrent:'현재 PIN 4자리를 입력해 주세요',
    morePinErrNew:    '새 PIN 4자리를 입력해 주세요',
    morePinErrMatch:  '새 PIN 확인이 일치하지 않습니다',
    morePinErrWrong:  '현재 PIN이 올바르지 않습니다',
    morePinErrSave:   '저장에 실패했습니다. 다시 시도해 주세요.',

    // ── 더보기 — 예산 설정 ────────────────────────────────────
    moreBudget:       '예산 설정',
    moreBudgetTarget: '목표 금액 (¥)',
    moreBudgetSave:   '저장',
    moreBudgetSuccess:'저장되었습니다 ✓',
    moreBudgetErrAmt: '올바른 금액을 입력해 주세요',
    moreBudgetErrSave:'저장에 실패했습니다. 다시 시도해 주세요.',

    // ── 더보기 — 카테고리 관리 ───────────────────────────────
    moreCat:            '카테고리 관리',
    moreCatBack:        '← 더보기',
    moreCatNone:        '카테고리가 없습니다',
    moreCatPlaceholder: '새 카테고리 이름 입력',
    moreCatAdd:         '추가',
    moreCatDelete:      '삭제',
    moreCatErrName:     '카테고리 이름을 입력해 주세요',
    moreCatErrDup:      '이미 존재하는 카테고리입니다',
    moreCatErrAdd:      '추가에 실패했습니다',
    moreCatErrDelete:   '삭제에 실패했습니다',

    // ── 더보기 — 언어 설정 ────────────────────────────────────
    moreLang:   '언어 / 言語',
    moreLangKo: '한국어',
    moreLangJa: '日本語',

    // ── 더보기 — LINE 알림 ────────────────────────────────────
    moreLine:           'LINE 알림',
    moreLineOn:         '켜짐',
    moreLineOff:        '꺼짐',
    moreLineRecipients: '수신자',
    moreLineNone:       '등록된 수신자가 없습니다',
    moreLineAddHint:    '파트너 추가: 봇 친구 추가 후 아무 메시지 전송 시 자동 등록',
    moreLineTxNotif:    '거래 등록 시 LINE 알림',
    moreLineTest:       '테스트 메시지 발송',
    moreLineTesting:    '발송 중...',
    moreLineTestSent:   '발송되었습니다 ✓',
    moreLineTestError:  '발송에 실패했습니다',
    moreLineToggleOn:   '알림 끄기',
    moreLineToggleOff:  '알림 켜기',
    moreLineDelete:     '삭제',

    // ── 더보기 — 데이터 초기화 ───────────────────────────────
    moreReset:        '데이터 초기화',
    moreResetWarning: '모든 거래 내역이 삭제됩니다. 계속하려면 PIN을 입력해 주세요.',
    moreResetPin:     'PIN',
    moreResetCheck:   '확인',
    moreResetChecking:'확인 중...',
    moreResetFinalW:  '⚠️ 모든 거래 내역이 영구 삭제됩니다',
    moreResetFinalS:  '이 작업은 되돌릴 수 없습니다.',
    moreResetCancel:  '취소',
    moreResetExec:    '초기화',
    moreResetExecing: '삭제 중...',
    moreResetDone:    '초기화가 완료되었습니다 ✓',
    moreResetErrPin:  'PIN 4자리를 입력해 주세요',
    moreResetErrWrong:'PIN이 올바르지 않습니다',
    moreResetErrFail: '확인에 실패했습니다. 다시 시도해 주세요.',
    moreResetErrExec: '초기화에 실패했습니다. 다시 시도해 주세요.',
  },

  ja: {
    // ── 공통 ──────────────────────────────────────────────────
    loading:   '読み込み中...',
    loadError: 'データの読み込みに失敗しました。',
    cancel:    'キャンセル',
    close:     '閉じる',
    income:    '収入',
    expense:   '支出',

    // ── 하단 탭바 ─────────────────────────────────────────────
    navHome:     'ホーム',
    navCalendar: 'カレンダー',
    navStats:    '統計',
    navMore:     '設定',

    // ── 연월 선택기 ───────────────────────────────────────────
    prevMonth: '前月',
    nextMonth: '翌月',

    // ── 홈 탭 ─────────────────────────────────────────────────
    budget:              '予算',
    budgetNotSet:        '未設定',
    remaining:           '残高',
    spent:               '% 使用',
    over:                '超過',
    monthlyIncome:       '今月の収入',
    noTransactions:      '今月の取引はありません。',
    noTransactionsHint:  '＋ボタンで最初の取引を追加しましょう。',

    // ── 달력 탭 ───────────────────────────────────────────────
    noTxOnDay: 'この日の取引はありません。',

    // ── 통계 탭 ───────────────────────────────────────────────
    noIncomeStats:  '今月の収入はありません。',
    noExpenseStats: '今月の支出はありません。',
    statsTotalLabel:   '合計',
    statsCountUnit:    '件',
    statsColContent:   '内容',
    statsColCount:     '件数',
    statsColAmount:    '金額',
    statsNoTx:         '取引はありません。',

    // ── 영수증 스캔 ───────────────────────────────────────────
    receiptScanBtn:     '領収書スキャン',
    receiptScanning:    '分析中...',
    receiptScanError:   '領収書の認識に失敗しました。',
    receiptScanFilled:  '領収書から自動入力しました。内容をご確認ください。',

    // ── 거래 입력 폼 ──────────────────────────────────────────
    formTitleAdd:       '取引を追加',
    formTitleEdit:      '取引を編集',
    formDate:           '日付',
    formCategory:       'カテゴリ',
    formAmount:         '金額',
    formMemo:           'メモ',
    formMemoOpt:        '（任意）',
    formMemoPlaceholder:'例：友人とランチ、スーパー',
    formSave:           '保存',
    formSaveEdit:       '更新',
    formSaving:         '保存中...',
    errCategory:        'カテゴリを選択してください',
    errAmount:          '金額を入力してください',
    errSave:            '保存に失敗しました。もう一度お試しください。',

    // ── 거래 상세 시트 ────────────────────────────────────────
    txDetail:        '取引詳細',
    txDate:          '日付',
    txType:          '種類',
    txCategory:      'カテゴリ',
    txAmount:        '金額',
    txMemo:          'メモ',
    txEdit:          '編集',
    txDelete:        '削除',
    txDeleteConfirm: '取引を削除しますか？',
    txDeleting:      '削除中...',
    txDeleteError:   '削除に失敗しました。もう一度お試しください。',
    txDeleteCancel:  'キャンセル',

    // ── 더보기 탭 — 공통 ──────────────────────────────────────
    moreCurrent: '現在',

    // ── 더보기 — PIN 변경 ─────────────────────────────────────
    morePin:          'PIN番号変更',
    morePinCurrent:   '現在のPIN',
    morePinNew:       '新しいPIN',
    morePinConfirm:   '新しいPIN（確認）',
    morePinSave:      '変更を保存',
    morePinSuccess:   'PINが変更されました ✓',
    morePinErrCurrent:'現在のPIN（4桁）を入力してください',
    morePinErrNew:    '新しいPIN（4桁）を入力してください',
    morePinErrMatch:  '新しいPINが一致しません',
    morePinErrWrong:  '現在のPINが正しくありません',
    morePinErrSave:   '保存に失敗しました。もう一度お試しください。',

    // ── 더보기 — 예산 설정 ────────────────────────────────────
    moreBudget:       '予算設定',
    moreBudgetTarget: '目標金額 (¥)',
    moreBudgetSave:   '保存',
    moreBudgetSuccess:'保存しました ✓',
    moreBudgetErrAmt: '正しい金額を入力してください',
    moreBudgetErrSave:'保存に失敗しました。もう一度お試しください。',

    // ── 더보기 — 카테고리 관리 ───────────────────────────────
    moreCat:            'カテゴリ管理',
    moreCatBack:        '← 設定',
    moreCatNone:        'カテゴリがありません',
    moreCatPlaceholder: '新しいカテゴリ名を入力',
    moreCatAdd:         '追加',
    moreCatDelete:      '削除',
    moreCatErrName:     'カテゴリ名を入力してください',
    moreCatErrDup:      'すでに存在するカテゴリです',
    moreCatErrAdd:      '追加に失敗しました',
    moreCatErrDelete:   '削除に失敗しました',

    // ── 더보기 — 언어 설정 ────────────────────────────────────
    moreLang:   '言語 / 언어',
    moreLangKo: '한국어',
    moreLangJa: '日本語',

    // ── 더보기 — LINE 알림 ────────────────────────────────────
    moreLine:           'LINE通知',
    moreLineOn:         'オン',
    moreLineOff:        'オフ',
    moreLineRecipients: '受信者',
    moreLineNone:       '登録された受信者はいません',
    moreLineAddHint:    'パートナー追加: BotをLINE友達追加後、メッセージを送ると自動登録されます',
    moreLineTxNotif:    '取引登録時にLINE通知',
    moreLineTest:       'テストメッセージ送信',
    moreLineTesting:    '送信中...',
    moreLineTestSent:   '送信しました ✓',
    moreLineTestError:  '送信に失敗しました',
    moreLineToggleOn:   '通知をオフ',
    moreLineToggleOff:  '通知をオン',
    moreLineDelete:     '削除',

    // ── 더보기 — 데이터 초기화 ───────────────────────────────
    moreReset:        'データ初期化',
    moreResetWarning: 'すべての取引データが削除されます。続けるにはPINを入力してください。',
    moreResetPin:     'PIN',
    moreResetCheck:   '確認',
    moreResetChecking:'確認中...',
    moreResetFinalW:  '⚠️ すべての取引データが完全に削除されます',
    moreResetFinalS:  'この操作は元に戻せません。',
    moreResetCancel:  'キャンセル',
    moreResetExec:    '初期化',
    moreResetExecing: '削除中...',
    moreResetDone:    '初期化が完了しました ✓',
    moreResetErrPin:  'PIN（4桁）を入力してください',
    moreResetErrWrong:'PINが正しくありません',
    moreResetErrFail: '確認に失敗しました。もう一度お試しください。',
    moreResetErrExec: '初期化に失敗しました。もう一度お試しください。',
  },
} as const;

export type TranslationKey = keyof typeof translations.ko;
