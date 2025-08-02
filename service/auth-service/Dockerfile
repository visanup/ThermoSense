# ——— Stage 1: build ———
FROM node:18-alpine AS builder

WORKDIR /app

# install dependencies
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# copy source and compile
COPY tsconfig.json ./
COPY src/ ./src
RUN yarn build

# ——— Stage 2: runtime ———
FROM node:18-alpine

WORKDIR /app

# install only production deps
COPY package.json yarn.lock ./
RUN yarn install --production --frozen-lockfile

# copy compiled output
COPY --from=builder /app/dist ./dist

# set environment
ENV NODE_ENV=production

# expose sensor-service port
#EXPOSE 4100

# start the service
CMD ["node", "dist/server.js"]