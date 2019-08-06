FROM node:10-alpine
WORKDIR /usr/src/app
COPY package.json yarn.lock tsconfig.json ./
COPY src ./src
COPY redis-scripts ./redis-scripts
RUN yarn install && yarn build && rm -rf node_modules && yarn install --production && yarn cache clean

FROM node:10-alpine
WORKDIR /usr/src/app
COPY --from=0 /usr/src/app/package.json .
COPY --from=0 /usr/src/app/dest ./dest
COPY --from=0 /usr/src/app/node_modules ./node_modules
COPY --from=0 /usr/src/app/redis-scripts ./redis-scripts
CMD ["yarn", "start"]