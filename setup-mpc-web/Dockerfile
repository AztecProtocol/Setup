FROM node:10
WORKDIR /usr/src/setup-mpc-common
COPY setup-mpc-common .
RUN yarn install && yarn build && yarn cache clean && yarn link
WORKDIR /usr/src/setup-mpc-client
COPY setup-mpc-client .
RUN yarn install && yarn build && rm -rf node_modules && yarn install --production && yarn cache clean && yarn link
WORKDIR /usr/src/setup-mpc-web
COPY setup-mpc-web .
RUN yarn install && yarn build && rm -rf node_modules && yarn install --production && yarn cache clean
CMD ["yarn", "start"]