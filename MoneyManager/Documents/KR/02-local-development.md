# Phase 1: 로컬 개발 환경 구성

## 목표

TypeScript + Express + Firestore SDK를 이용해 로컬에서 실행 가능한 API 서버를 만드는 것입니다.

## 프로젝트 초기화

### npm 초기화

```bash
npm init -y
```

`package.json` 파일을 생성합니다. Node.js 프로젝트의 기본 설정 파일입니다.

### 패키지 설치

```bash
# 실제 서비스에서 사용하는 패키지
npm install express @google-cloud/firestore

# 개발 시에만 사용하는 패키지
npm install --save-dev typescript @types/node @types/express ts-node
```

| 패키지 | 용도 |
|--------|------|
| `express` | HTTP 서버 |
| `@google-cloud/firestore` | Firestore 데이터베이스 연동 |
| `typescript` | TypeScript 컴파일러 |
| `@types/node` | Node.js TypeScript 타입 정의 |
| `@types/express` | Express TypeScript 타입 정의 |
| `ts-node` | TypeScript를 직접 실행 (개발용) |

## 파일 구조

```
MoneyManager/
  src/
    index.ts              # 서버 진입점
    routes/
      transactions.ts     # 거래 내역 API 라우터
    services/
      firestore.ts        # Firestore 연동 로직
  tsconfig.json           # TypeScript 설정
  package.json            # 프로젝트 설정 및 스크립트
  .gitignore              # Git 제외 파일 목록
```

## 주요 파일 설명

### tsconfig.json

TypeScript 컴파일러 설정 파일입니다.

```json
{
  "compilerOptions": {
    "target": "ES2020",       // 어떤 JavaScript 버전으로 변환할지
    "module": "commonjs",     // 모듈 시스템 (Node.js 표준)
    "outDir": "./dist",       // 컴파일된 파일 출력 위치
    "rootDir": "./src",       // TypeScript 소스 파일 위치
    "strict": true            // 엄격한 타입 검사 활성화
  }
}
```

**strict 모드란?**
`any` 타입 사용 금지, null 체크 강제 등 타입 안전성을 높이는 설정입니다.
코드 작성이 약간 까다롭지만, 런타임 오류를 사전에 방지합니다.

### src/index.ts (서버 진입점)

```typescript
const PORT = process.env.PORT || 8080;
```

포트를 환경 변수에서 읽는 이유: Cloud Run은 컨테이너를 실행할 때 `PORT` 환경 변수를 자동으로 설정합니다.
로컬에서는 환경 변수가 없으므로 기본값 8080을 사용합니다.

### src/services/firestore.ts (데이터베이스 로직)

Firestore와 직접 통신하는 함수들이 모여 있습니다.

**Transaction 인터페이스:**

```typescript
interface Transaction {
  id?: string;
  type: 'income' | 'expense';  // 수입 또는 지출만 허용
  amount: number;
  category: string;
  description: string;
  date: string;                 // ISO 8601 형식 (예: "2026-06-17")
}
```

**CRUD 함수:**

| 함수 | 역할 |
|------|------|
| `createTransaction` | 새 거래 내역 생성 |
| `getTransactions` | 전체 목록 조회 (날짜 내림차순) |
| `getTransactionById` | ID로 단건 조회 |
| `updateTransaction` | 거래 내역 수정 |
| `deleteTransaction` | 거래 내역 삭제 |

### src/routes/transactions.ts (API 라우터)

HTTP 요청을 받아서 Firestore 함수를 호출하고 응답을 반환합니다.

## 실행 방법

```bash
# 개발 모드 (소스 코드 직접 실행, 빌드 불필요)
npm run dev

# 프로덕션 모드 (빌드 후 실행)
npm run build
npm start
```

### 로컬에서 Firestore 사용 시 주의사항

로컬에서 실행할 때 Firestore에 접근하려면 GCP 인증이 필요합니다:

```bash
gcloud auth application-default login
```

이 명령어를 실행하면 로컬 환경에서도 실제 GCP Firestore에 연결할 수 있습니다.

## package.json 스크립트

```json
{
  "scripts": {
    "build": "tsc",           // TypeScript → JavaScript 컴파일
    "start": "node dist/index.js",  // 컴파일된 파일 실행
    "dev": "ts-node src/index.ts"   // 개발용 직접 실행
  }
}
```
