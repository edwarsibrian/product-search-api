# ---- Base ----
FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./

# ---- Dependencies (all, incl. dev, for build/test) ----
FROM base AS dependencies
RUN npm ci

# ---- Build ----
FROM dependencies AS build
COPY . .
RUN npm run build

# ---- Production dependencies only ----
FROM base AS prod-dependencies
RUN npm ci --omit=dev

# ---- Runtime ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Non-root user for security
RUN addgroup -S nodegroup && adduser -S nodeuser -G nodegroup

COPY --from=prod-dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package*.json ./

USER nodeuser

EXPOSE 3000

CMD ["node", "dist/main"]
