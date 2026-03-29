# Build frontend, then run API + static SPA on one process (PORT from host, e.g. Render/Fly).
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY --from=build /app/client/dist ./client/dist
COPY --from=build /app/admin/dist ./admin/dist
RUN chown -R node:node /app
USER node
EXPOSE 3001
CMD ["node", "server/index.js"]
