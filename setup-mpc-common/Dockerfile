FROM node:10
WORKDIR /usr/src/setup-mpc-common
COPY . .
RUN yarn install && yarn test && yarn build && rm -rf node_modules && yarn install --production

FROM node:10-alpine
COPY --from=0 /usr/src/setup-mpc-common /usr/src/setup-mpc-common