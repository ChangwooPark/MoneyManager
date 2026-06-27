# Phase 2: Docker 컨테이너화

## Docker란?

애플리케이션을 **컨테이너**라는 독립된 환경에 담아서 실행하는 기술입니다.
"내 컴퓨터에서는 됐는데 서버에서 안 된다"는 문제를 해결합니다.
어떤 환경에서도 동일하게 동작하는 것이 핵심입니다.

```
컨테이너 = 앱 코드 + 런타임(Node.js) + 설정 + 의존성
```

## Dockerfile

Docker 이미지를 만드는 설계도입니다.

```dockerfile
# Stage 1: Build (빌드 환경)
FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm install --save-dev typescript@latest --ignore-scripts
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc

# Stage 2: Production (실행 환경)
FROM node:22-alpine AS runner

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "dist/index.js"]
```

## 멀티스테이지 빌드란?

이 Dockerfile은 두 단계(Stage)로 나뉩니다.

```
Stage 1 (builder)
  node:22-alpine 이미지
  + 모든 패키지 설치 (devDependencies 포함)
  + TypeScript 컴파일 → dist/ 생성
  → 이 단계의 결과물만 Stage 2로 전달

Stage 2 (runner)  ← 최종 이미지
  node:22-alpine 이미지
  + 운영 패키지만 설치 (devDependencies 제외)
  + dist/ 파일만 복사
  → 불필요한 파일 없는 작은 이미지
```

**왜 나누나?**
TypeScript 컴파일러, 타입 정의 파일 등은 빌드 시에만 필요합니다.
최종 이미지에서 이것들을 제외하면 이미지 크기가 줄어들고 보안도 향상됩니다.

## 주요 명령어 설명

| 명령어 | 의미 |
|--------|------|
| `FROM node:22-alpine` | Node.js 22 기반의 Alpine Linux 이미지 사용 (가벼운 Linux) |
| `WORKDIR /app` | 컨테이너 내부 작업 디렉토리 설정 |
| `COPY package*.json ./` | package.json, package-lock.json 복사 |
| `RUN npm ci` | package-lock.json 기준으로 정확한 버전 설치 |
| `EXPOSE 8080` | 컨테이너가 8080 포트를 사용함을 명시 |
| `CMD ["node", "dist/index.js"]` | 컨테이너 시작 시 실행할 명령 |

## .dockerignore

Docker 빌드 시 불필요한 파일을 제외합니다 (`.gitignore`와 같은 개념):

```
node_modules/   # 컨테이너 안에서 다시 설치하므로 불필요
dist/           # 컨테이너 안에서 다시 빌드하므로 불필요
.env            # 보안 정보는 절대 포함하면 안 됨
```

## 로컬에서 Docker 실행

```bash
# 이미지 빌드
docker build -t money-manager:local .

# 컨테이너 실행 (로컬 8080 포트 → 컨테이너 8080 포트)
docker run -p 8080:8080 money-manager:local

# 동작 확인
curl http://localhost:8080/health
# → {"status":"ok"}

# 컨테이너 중지 및 삭제
docker stop money-manager-test
docker rm money-manager-test
```

## Docker 없이 개발할 때와의 차이

| 항목 | Docker 없이 | Docker 사용 |
|------|------------|------------|
| 실행 | `npm run dev` | `docker run` |
| 환경 | 내 컴퓨터 Node.js 버전에 의존 | 항상 Node.js 22 |
| 배포 | 서버에 Node.js 설치 필요 | 이미지만 전달 |
| 격리 | 없음 | 완전 격리 |
