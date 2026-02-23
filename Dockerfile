# Stage 1: Build client + server
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/
RUN npm ci
COPY . .
RUN npm run build --workspace=client
RUN npm run build --workspace=server

# Stage 2: Production
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json ./server/
RUN npm ci --workspace=server --omit=dev
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/client/dist ./client/dist
COPY tsconfig.base.json ./

# Create data directory
RUN mkdir -p /app/server/data

EXPOSE 3001
ENV PORT=3001
ENV NODE_ENV=production

CMD ["npm", "start", "--workspace=server"]
