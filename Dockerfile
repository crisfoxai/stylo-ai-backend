FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps --omit=dev && npm rebuild sharp
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main"]
