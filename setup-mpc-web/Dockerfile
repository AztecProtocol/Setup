FROM node:10
COPY setup-mpc-common /usr/src/setup-mpc-common
WORKDIR /usr/src/setup-mpc-client
COPY setup-mpc-client .
RUN yarn install && yarn build && rm -rf node_modules && yarn install --production && yarn cache clean
WORKDIR /usr/src/setup-mpc-web
COPY setup-mpc-web .
RUN yarn install && yarn build && rm -rf node_modules && yarn install --production && yarn cache clean
CMD ["yarn", "start"]