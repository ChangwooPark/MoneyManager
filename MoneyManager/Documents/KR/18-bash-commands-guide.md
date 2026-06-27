# Bash 명령어 가이드

개발 과정에서 자주 사용하는 bash 명령어들을 목적별로 정리합니다.
새로운 명령어가 등장할 때마다 이 문서에 추가해 나갑니다.

---

## 0. 배경 지식 — Bash / 터미널 / 셸이란?

### 터미널(Terminal)이란?

컴퓨터에 **텍스트로 명령을 내리는 창**입니다.  
마우스로 아이콘을 클릭하는 대신, 키보드로 명령어를 입력해 컴퓨터를 조작합니다.

```
macOS → 터미널(Terminal) 앱 또는 iTerm2
Windows → PowerShell, WSL(Windows Subsystem for Linux)
```

### 셸(Shell)이란?

터미널 창 안에서 실제로 명령어를 해석하고 실행하는 **프로그램**입니다.  
터미널은 "창(화면)", 셸은 "그 안에서 동작하는 언어 해석기"라고 생각하면 됩니다.

```
셸의 종류:
  bash  → 가장 널리 쓰이는 셸 (Bourne Again SHell)
  zsh   → macOS 기본 셸 (bash와 거의 동일하게 사용 가능)
  sh    → 가장 기본적인 셸
```

### Bash란?

**B**ourne **A**gain **SH**ell의 약자입니다.  
Linux/macOS에서 가장 많이 쓰이는 셸 언어로, 이 문서에서 설명하는 명령어들은 모두 bash(및 zsh)에서 동작합니다.

### 프롬프트(Prompt)란?

터미널에서 명령어를 입력할 수 있는 상태를 나타내는 기호입니다.

```bash
cw-park@MacBook ~ %    # zsh 프롬프트 (% 기호)
cw-park@MacBook ~ $    # bash 프롬프트 ($ 기호)
```

`%` 또는 `$` 뒤에 커서가 깜빡이고 있으면 명령어를 입력할 준비가 된 상태입니다.

### 경로(Path)란?

파일이나 폴더의 위치를 나타내는 주소입니다.

```
절대 경로: /Users/cw-park/project/frontend/src/components
           ↑ 루트(최상위)부터 시작, 항상 /로 시작

상대 경로: ./src/components   (현재 위치 기준)
           ../components      (한 단계 위 기준)
```

- `/` = 최상위 폴더 (루트)
- `~` = 현재 사용자의 홈 폴더 (`/Users/cw-park`)
- `.` = 현재 폴더
- `..` = 한 단계 위 폴더

### stdin / stdout / stderr란?

프로그램이 데이터를 주고받는 세 가지 통로(스트림)입니다.

| 이름 | 번호 | 설명 |
|---|---|---|
| stdin (표준 입력) | 0 | 프로그램에 데이터를 넣는 통로 (보통 키보드) |
| stdout (표준 출력) | 1 | 프로그램이 결과를 내보내는 통로 (보통 화면) |
| stderr (표준 오류) | 2 | 프로그램이 오류를 내보내는 통로 (보통 화면) |

`2>&1` 같은 기호가 이 스트림 번호를 사용합니다.

---

## 1. 파일 탐색 — `find` / `grep` / `ls`

### 1-1. 특정 파일 찾기: `find`

```bash
find /경로 -name "파일명패턴"
```

**용도**: 파일이 어느 폴더에 있는지 모를 때 검색합니다.

```bash
# 예시: CalendarTab 이라는 이름을 포함한 파일 찾기 (node_modules 제외)
find ./frontend/src -name "CalendarTab*" -o -name "Calendar*" | grep -v node_modules
```

| 부분 | 의미 |
|---|---|
| `find <경로>` | 이 경로 아래 모든 폴더를 재귀적으로 탐색 |
| `-name "CalendarTab*"` | 파일명이 `CalendarTab`으로 시작하는 파일 (`*`는 "아무 문자나") |
| `-o` | OR 조건 (또는) |
| `\| grep -v node_modules` | 결과에서 `node_modules`가 포함된 줄 제거 (`-v` = 제외) |

**`-not -path` 로 특정 경로 제외하기**:

```bash
# 예시: 모든 PNG 파일을 찾되 node_modules 폴더는 제외
find . -name "*.png" -not -path "*/node_modules/*" | sort
```

| 부분 | 의미 |
|---|---|
| `-not -path "패턴"` | 경로가 이 패턴에 해당하는 결과는 제외 |
| `"*/node_modules/*"` | 경로 어딘가에 `node_modules` 폴더가 포함된 것 (`*` = 아무 경로나) |

> `-o`(OR)와 `-not`(NOT)은 `find`의 **조건 연산자**입니다.  
> `grep -v node_modules` 방식과 달리, `-not -path` 는 탐색 단계에서 폴더를 아예 제외하므로 더 효율적입니다.

---

### 1-2. 파일 내용에서 특정 단어 찾기: `grep`

```bash
grep -n "찾을단어" 파일경로
```

**용도**: 특정 변수명, 함수명, 설정값이 어느 줄에 있는지 찾을 때 사용합니다.

```bash
# 예시: MainApp.tsx 에서 3개 단어 중 하나라도 포함된 줄 찾기
grep -n "CalendarTab\|refreshKey\|yearMonth" frontend/src/components/MainApp.tsx | head -30
```

| 부분 | 의미 |
|---|---|
| `grep` | 파일에서 패턴을 검색하는 명령어 |
| `-n` | 검색 결과에 **줄 번호** 함께 출력 |
| `"단어A\|단어B\|단어C"` | 단어A 또는 단어B 또는 단어C 중 하나 포함된 줄 (`\|` = OR) |
| `\| head -30` | 결과 중 위에서 30줄만 출력 |

```bash
# 예시: CSS 변수 색상값 확인
grep -n "--income\|--expense\|--accent" frontend/src/app/globals.css
```

```bash
# 예시: 버튼의 aria-label 값 확인 (E2E 테스트 셀렉터 작성 전 확인용)
grep -n "aria-label" frontend/src/components/layout/MonthSelector.tsx
```

```bash
# 예시: 특정 상수/키 이름 확인
grep -n "SESSION_KEY" frontend/src/components/AppShell.tsx
```

---

### 1-3. 폴더 내용 목록 보기: `ls`

```bash
ls 경로
ls 경로 | sort
```

**용도**: 폴더 안에 어떤 파일/폴더가 있는지 확인합니다.

```bash
# 예시: Documents 폴더 파일 목록을 정렬해서 보기
ls ./Documents/ | sort
```

| 부분 | 의미 |
|---|---|
| `ls <경로>` | 해당 경로의 파일/폴더 목록 출력 |
| `\| sort` | 결과를 알파벳/번호순 정렬 |

자주 쓰는 옵션:

| 옵션 | 의미 |
|---|---|
| `ls -l` | 파일 크기, 권한, 날짜 등 상세 정보 표시 |
| `ls -a` | 숨김 파일(`.`으로 시작)도 표시 |
| `ls -la` | 상세 + 숨김 파일 모두 표시 |

---

## 2. TypeScript 타입 검사 — `npx tsc`

```bash
npx tsc --noEmit 2>&1
```

**용도**: 코드 작성 후 타입 오류가 있는지 확인합니다. 실제 빌드 파일은 생성하지 않습니다.

| 부분 | 의미 |
|---|---|
| `npx` | 로컬 `node_modules/.bin/` 에 설치된 명령어를 실행하는 도구 |
| `tsc` | TypeScript 컴파일러 (TypeScript → JavaScript 변환) |
| `--noEmit` | 타입 검사만 하고 `.js` 파일은 생성하지 않음 |
| `2>&1` | 오류 출력(stderr)을 화면 출력(stdout)에 합쳐서 한 곳에 표시 |

**결과 해석**:
- 아무것도 출력 안 됨 → 타입 오류 없음 (정상)
- `error TS2345: ...` 같은 메시지 → 해당 줄에 타입 오류 있음

---

## 3. 개발 서버 관리

### 3-1. 개발 서버 시작: `npm run dev`

```bash
npm run dev > /tmp/nextdev.log 2>&1 &
echo "PID: $!"
```

**용도**: Next.js 개발 서버를 백그라운드에서 켜서 브라우저로 앱을 확인합니다.

| 부분 | 의미 |
|---|---|
| `npm run dev` | `package.json`의 `dev` 스크립트 실행 (프로젝트마다 다름) |
| `> /tmp/nextdev.log` | 표준 출력을 파일에 저장 (`>` = 덮어쓰기) |
| `2>&1` | 오류 출력도 같은 파일에 합쳐 저장 |
| `&` | **백그라운드 실행** — 서버가 켜진 채로 터미널을 계속 사용 가능 |
| `echo "PID: $!"` | 방금 시작한 프로세스 ID 출력 (`$!` = 가장 최근 백그라운드 프로세스 ID) |

> **PID(Process ID)**: 운영체제가 각 프로세스(실행 중인 프로그램)에 부여하는 고유 번호.  
> 나중에 `kill <PID>` 로 해당 프로세스를 종료할 때 사용합니다.

---

### 3-2. 서버 응답 확인: `curl`

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
```

**용도**: 개발 서버가 완전히 시작되어 응답하는지 확인합니다.

| 부분 | 의미 |
|---|---|
| `curl` | URL로 HTTP 요청을 보내는 명령어 |
| `-s` | silent 모드 — 진행률 표시 없이 조용히 실행 |
| `-o /dev/null` | 응답 본문을 버림 (`/dev/null` = 모든 것을 삼키는 가상 쓰레기통) |
| `-w "%{http_code}"` | 응답의 HTTP 상태 코드만 출력 |
| `http://localhost:3000` | 로컬 개발 서버 주소 |

**HTTP 상태 코드**:

| 코드 | 의미 |
|---|---|
| `200` | OK — 서버 정상 응답 |
| `404` | Not Found — 해당 경로 없음 |
| `500` | Server Error — 서버 오류 |
| `000` | 연결 실패 — 서버가 아직 시작 안 됨 |

---

### 3-3. 특정 포트 프로세스 강제 종료: `lsof` + `kill`

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; echo "killed"
```

**용도**: 3000번 포트를 이미 다른 프로세스가 점유해서 서버가 시작 안 될 때 해결합니다.

| 부분 | 의미 |
|---|---|
| `lsof` | List Open Files — 열려있는 파일/포트 목록 조회 |
| `-t` | PID(프로세스 ID)만 출력 |
| `-i:3000` | 3000번 포트를 사용 중인 프로세스만 필터링 |
| `\| xargs kill -9` | 앞에서 받은 PID를 `kill -9 <PID>` 명령에 인자로 전달 |
| `kill -9` | 강제 종료 신호(SIGKILL) 전송 — 무조건 즉시 종료 |
| `2>/dev/null` | 오류 메시지 버림 (프로세스가 없어도 오류 없이 진행) |
| `; echo "killed"` | 앞 명령 성공/실패 무관하게 "killed" 출력 |

> **`xargs`**: 앞 명령어의 출력을 다음 명령어의 **인자(argument)** 로 넘겨주는 도구.  
> `lsof -ti:3000` 이 `12140` 을 출력하면, `xargs kill -9` 는 `kill -9 12140` 을 실행합니다.

---

### 3-4. 로그 파일 끝부분 확인: `tail`

```bash
tail -5 /tmp/nextdev.log
```

**용도**: 개발 서버 로그 파일의 최신 내용 5줄만 확인합니다.

| 부분 | 의미 |
|---|---|
| `tail` | 파일의 끝부분을 출력 (반대: `head` = 파일 앞부분) |
| `-5` | 마지막 5줄만 출력 (`-n 5` 와 동일) |

> 로그 파일은 시간이 지날수록 길어지므로, 최신 정보는 항상 파일 끝에 있습니다.  
> `tail` 은 그 최신 내용만 빠르게 확인하는 데 유용합니다.

---

## 4. Playwright E2E 테스트

### 4-1. 테스트 실행: `npx playwright test`

```bash
npx playwright test tests/home-tab.spec.ts --reporter=list 2>&1
```

**용도**: 특정 테스트 파일을 실행하고 결과를 목록 형태로 출력합니다.

| 부분 | 의미 |
|---|---|
| `npx playwright test` | Playwright 테스트 러너 실행 |
| `tests/파일명.spec.ts` | 이 파일의 테스트만 실행 (생략하면 모든 테스트 실행) |
| `--reporter=list` | 테스트 결과를 한 줄씩 목록 형태로 출력 |
| `--reporter=line` | 테스트 결과를 한 줄 요약으로 출력 (실행 중 진행 상황 확인에 유리) |
| `2>&1` | 오류 출력도 화면에 합쳐서 표시 |

**`--reporter` 옵션 비교**:

| 옵션 | 출력 형태 | 언제 쓰는가 |
|---|---|---|
| `--reporter=list` | 각 테스트를 한 줄씩 나열 | 어떤 테스트가 통과/실패했는지 개별 확인 |
| `--reporter=line` | 진행 중 상태를 한 줄에 업데이트 | 테스트 수가 많아 실행 중 진행 상황을 실시간으로 보고 싶을 때 |
| `--reporter=dot` | 점(`.`)으로만 표시 | 출력을 최소화하고 싶을 때 |

**결과 기호**:

| 기호 | 의미 |
|---|---|
| `✓` | 테스트 통과 |
| `✘` | 테스트 실패 |
| `○` | 테스트 스킵됨 |

```bash
# 모든 테스트 파일 한꺼번에 실행
npx playwright test --reporter=list 2>&1
```

---

### 4-2. 테스트 결과 파일 읽기: `cat` + `head`

백그라운드로 테스트를 실행하면 결과가 파일에 저장됩니다.

```bash
# 결과 파일 전체 내용 출력
cat /tmp/.../tasks/<ID>.output

# 결과 파일 앞부분 60줄만 출력
cat /tmp/.../tasks/<ID>.output | head -60
```

| 부분 | 의미 |
|---|---|
| `cat <파일>` | 파일 내용 전체를 화면에 출력 |
| `\| head -60` | 앞에서 60줄만 출력 |

---

## 5. 파일 삭제 — `rm`

```bash
rm 파일경로
rm 파일1 파일2 파일3
```

**용도**: 파일을 삭제합니다. 한 번에 여러 파일을 나열해서 지울 수 있습니다.

```bash
# 예시: PNG 파일 여러 개를 한 번에 삭제
rm calendar-tab.png stats-tab.png home-tab-phase10.png

# 예시: 특정 폴더 안 모든 PNG 삭제 (와일드카드 사용)
rm .playwright-mcp/page-*.png
```

| 부분 | 의미 |
|---|---|
| `rm <파일>` | 파일을 영구 삭제 (휴지통으로 가지 않음, 복구 불가) |
| `rm 파일1 파일2` | 여러 파일을 한 번에 삭제 |
| `rm -r <폴더>` | 폴더와 그 안의 내용을 모두 삭제 (`-r` = recursive, 재귀) |

> ⚠️ **주의**: `rm` 은 휴지통을 거치지 않고 즉시 삭제합니다.  
> 삭제 전에 `ls` 로 대상을 한 번 확인하는 습관이 중요합니다.

---

## 6. Git 명령어 — 저장 및 배포

### Git이란?


코드의 **변경 이력을 기록**하는 버전 관리 시스템입니다.  
언제, 누가, 어떤 내용을 바꿨는지 기록하고, 과거 상태로 되돌리거나 여러 명이 동시에 작업할 수 있게 합니다.

```
로컬(내 컴퓨터) ─── git push ──▶ 원격(GitHub)
                ◀── git pull ───
```

### 6-1. 변경 파일 스테이징: `git add`

```bash
git add 파일경로1 파일경로2
```

**용도**: 다음 커밋에 포함할 파일을 선택(스테이징)합니다.

```bash
# 특정 파일만 추가 (권장)
git add frontend/src/components/features/calendar/CalendarTab.tsx

# 현재 폴더 이하 모든 변경 파일 추가 (주의 필요)
git add .
```

> `git add .` 은 편리하지만 `.env` 같은 민감한 파일이 실수로 포함될 수 있으므로,  
> 가능하면 파일을 명시적으로 지정하는 것이 안전합니다.

---

### 6-2. 커밋 생성: `git commit`

```bash
git commit -m "$(cat <<'EOF'
Feat: 달력 탭 구현

- 7열 월간 그리드 달력 렌더링
- 날짜 클릭 시 바텀시트 표시

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

**용도**: 스테이징된 변경 내용을 로컬 저장소에 기록합니다.

| 부분 | 의미 |
|---|---|
| `git commit -m "..."` | `-m` 뒤의 텍스트를 커밋 메시지로 사용 |
| `$(...)` | 괄호 안 명령어를 실행하고 그 출력값으로 대체 (명령 치환) |
| `cat <<'EOF' ... EOF` | `EOF` 사이의 여러 줄 텍스트를 그대로 출력 (heredoc 문법) |

> **heredoc(`<<'EOF'`)**: 여러 줄 텍스트를 명령어에 전달하기 위한 문법.  
> `EOF`는 관례적으로 쓰는 구분자일 뿐, 다른 단어로 바꿔도 됩니다.

**커밋 메시지 앞에 붙이는 접두사 관례**:

| 접두사 | 의미 |
|---|---|
| `Feat:` | 새 기능 추가 |
| `Fix:` | 버그 수정 |
| `Docs:` | 문서 작성/수정 |
| `Test:` | 테스트 코드 추가/수정 |
| `Refactor:` | 기능 변경 없이 코드 구조 개선 |

---

### 6-3. 원격 저장소에 업로드: `git push`

```bash
git push origin main
```

**용도**: 로컬 커밋을 GitHub(원격 저장소)에 업로드합니다.

| 부분 | 의미 |
|---|---|
| `git push` | 로컬 커밋을 원격 저장소로 전송 |
| `origin` | 원격 저장소의 별칭 (보통 GitHub URL을 가리킴) |
| `main` | 푸시할 브랜치 이름 |

> 이 프로젝트는 `git push origin main` 을 하면  
> **GitHub Actions → Vercel 배포**까지 자동으로 진행됩니다.

---

### 6-4. 현재 상태 확인: `git status` / `git log`

```bash
# 변경된 파일 목록 확인
git status

# 변경된 파일 목록 — 단축 형식
git status --short

# 최근 커밋 이력 확인
git log --oneline -10
```

| 명령어 | 의미 |
|---|---|
| `git status` | 수정됨/스테이징됨/추적 안 됨 파일 목록을 상세 설명과 함께 표시 |
| `git status --short` | 파일 경로만 간결하게 표시 (`M`=수정됨, `??`=추적 안 됨, `A`=스테이징됨) |
| `git log --oneline` | 커밋 이력을 한 줄씩 간략하게 표시 |
| `-10` | 최근 10개만 표시 |

**`git status --short` 출력 예시**:
```
 M src/components/MainApp.tsx     ← 수정됨 (스테이징 안 됨)
?? Documents/19-phase12-stats-tab.md  ← 새 파일 (추적 안 됨)
A  frontend/tests/stats-tab.spec.ts   ← 스테이징됨
```

---

### 6-5. Git 루트 경로 확인: `git rev-parse`

```bash
git rev-parse --show-toplevel
```

**용도**: 현재 Git 저장소의 최상위 폴더(루트) 경로를 확인합니다. 현재 어느 폴더에 있든 상관없이 Git 저장소 루트를 알 수 있습니다.

```bash
# 예시: frontend 폴더 안에 있어도 프로젝트 루트를 알 수 있음
$ pwd
/Users/cw-park/private-project/MoneyManager/frontend

$ git rev-parse --show-toplevel
/Users/cw-park/private-project
```

| 부분 | 의미 |
|---|---|
| `git rev-parse` | Git 내부 참조(커밋 해시, 경로 등)를 해석하는 다목적 명령어 |
| `--show-toplevel` | Git 저장소의 루트 폴더 절대 경로 출력 |

> **왜 필요한가?** `git add 파일경로` 는 항상 Git 루트 기준 상대 경로를 써야 합니다.  
> 현재 위치가 `frontend/` 안이라면 `frontend/src/...` 처럼 경로를 맞춰야 합니다.  
> `git rev-parse --show-toplevel` 로 루트를 확인하면 경로 실수를 방지할 수 있습니다.

---

## 7. 특수 기호 한눈에 보기

| 기호 | 이름 | 의미 |
|---|---|---|
| `\|` | 파이프 (pipe) | 왼쪽 출력을 오른쪽 명령어의 입력으로 전달 |
| `>` | 리다이렉션 | 출력을 파일에 저장 (기존 내용 덮어쓰기) |
| `>>` | 추가 리다이렉션 | 출력을 파일 끝에 추가 (기존 내용 유지) |
| `2>&1` | 오류 합치기 | stderr(2번)를 stdout(1번)으로 합침 |
| `2>/dev/null` | 오류 버리기 | 오류 메시지를 /dev/null(쓰레기통)에 버림 |
| `&` | 백그라운드 | 명령어를 백그라운드에서 실행 |
| `&&` | AND 연결 | 앞 명령어 **성공 시에만** 다음 명령어 실행 |
| `;` | 순차 실행 | 앞 명령어 성공/실패 무관하게 다음 명령어 실행 |
| `$!` | 변수 | 가장 최근 백그라운드 프로세스의 PID |
| `$( )` | 명령 치환 | 괄호 안 명령어 실행 결과로 대체 |
| `~` | 홈 디렉토리 | 현재 사용자의 홈 폴더 (`/Users/cw-park`) |
| `.` | 현재 디렉토리 | 지금 있는 폴더 |
| `..` | 부모 디렉토리 | 한 단계 위 폴더 |
| `*` | 와일드카드 | "아무 문자나" 를 의미하는 패턴 |

---

## 8. 개발 작업 흐름에서 명령어가 쓰이는 순서

```
코드 작성 전 — 기존 코드 파악
   find, grep -n, ls
   → 파일 위치 확인, 관련 코드 줄 번호 확인
   git rev-parse --show-toplevel
   → Git 루트 경로 확인 (git add 경로 기준점 파악)

코드 작성 후 — 오류 확인
   npx tsc --noEmit
   → TypeScript 타입 오류 없는지 검사

브라우저로 화면 확인
   npm run dev &          → 개발 서버 시작
   curl localhost:3000    → 서버 응답 확인
   lsof -ti:포트 | xargs kill -9  → 포트 충돌 시 해결

E2E 테스트 실행
   npx playwright test tests/파일.spec.ts --reporter=line

저장 및 배포
   git status --short     → 변경 파일 목록 간단히 확인
   git add 파일 → git commit → git push origin main
   → GitHub Actions → Vercel 자동 배포

불필요한 파일 정리
   find . -name "*.png" -not -path "*/node_modules/*"  → 대상 확인
   rm 파일1 파일2 ...     → 확인 후 삭제
```
