# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm install --save-dev typescript@latest --ignore-scripts

COPY tsconfig.json ./
COPY src ./src

RUN npx tsc

# Stage 2: Production
FROM node:22-alpine AS runner

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production

EXPOSE 8080

CMD ["node", "dist/index.js"]
