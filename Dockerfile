FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
# better-sqlite3 (von @actual-app/api) hat für Alpine keine fertigen Binärdateien
RUN apk add --no-cache python3 make g++
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
	PORT=3000 \
	DATA_DIR=/data
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY package.json server.js ./
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
	CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "--disable-warning=ExperimentalWarning", "server.js"]
