# Build stage — compile TypeScript
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Runtime stage — production deps only
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist

# Cloud Run injects PORT; the app reads process.env.PORT
EXPOSE 3000
CMD ["node", "dist/index.js"]
