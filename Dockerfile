FROM node:21-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install

FROM deps AS builder
WORKDIR /app
COPY . .
RUN npm run build

FROM deps AS prod-deps
WORKDIR /app
COPY prisma ./prisma/
RUN npm i --omit=dev
RUN npx prisma generate

FROM base AS runner
WORKDIR /app

RUN addgroup --system --gid 111 remix
RUN adduser --system --uid 111 remix
USER remix

COPY --from=prod-deps --chown=remix:remix /app/package*.json ./
COPY --from=prod-deps --chown=remix:remix /app/node_modules ./node_modules
COPY --from=prod-deps /app/prisma ./prisma
COPY --from=builder --chown=remix:remix /app/build ./build
COPY --from=builder --chown=remix:remix /app/public ./public
COPY --from=builder --chown=remix:remix /app/server.js ./server.js

CMD [ "env", "NODE_ENV=production", "node", "server.js"] 
