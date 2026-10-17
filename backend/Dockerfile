FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci
COPY shared shared
COPY backend backend
RUN npm run build -w backend

FROM node:22-bookworm-slim
ENV NODE_ENV=production
ENV PORT=80
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/package.json /app/package.json
COPY --from=build /app/package-lock.json /app/package-lock.json
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/backend/package.json /app/backend/package.json
COPY --from=build /app/backend/prisma.config.ts /app/backend/prisma.config.ts
COPY --from=build /app/backend/prisma /app/backend/prisma
COPY --from=build /app/backend/dist /app/backend/dist
USER node
WORKDIR /app/backend
EXPOSE 80
CMD ["node", "dist/main.js"]
