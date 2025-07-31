# services/sensor-service/Dockerfile

# ——— Stage 1: build ———
FROM node:18-alpine AS builder

WORKDIR /app

# install dev & prod deps
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# compile TS to JS
COPY tsconfig.json ./
COPY src ./src
RUN yarn build

# ——— Stage 2: runtime ———
FROM node:18-alpine

WORKDIR /app

# only prod deps
COPY package.json yarn.lock ./
RUN yarn install --production --frozen-lockfile

# copy compiled output
COPY --from=builder /app/dist ./dist

# expose the sensor-service port
ENV NODE_ENV=production
EXPOSE 4107

# start the service
CMD ["node", "dist/server.js"]
