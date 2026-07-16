FROM node:24-alpine AS builder
WORKDIR /app

COPY package.json yarn.lock ./
COPY . .

RUN yarn install --frozen-lockfile \
    && yarn build \
    && rm -rf .next/cache \
    && rm -rf node_modules \
    && yarn install --production --frozen-lockfile \
    && yarn cache clean

FROM node:24-alpine
WORKDIR /app

ENV NODE_ENV="production"

COPY --from=builder /app/package.json /app/yarn.lock ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js /app/next.config.env.js ./
COPY --from=builder /app/sentry.client.config.js /app/sentry.server.config.js /app/sentry.edge.config.js ./
COPY --from=builder /app/startServer.js ./
COPY --from=builder /app/.env* ./

EXPOSE 3000 443

CMD ["yarn", "start"]