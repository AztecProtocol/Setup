FROM 278380418400.dkr.ecr.eu-west-2.amazonaws.com/setup-mpc-common:latest
FROM 278380418400.dkr.ecr.eu-west-2.amazonaws.com/setup-mpc-client:latest

FROM node:10
WORKDIR /usr/src/setup-mpc-common
COPY --from=0 /usr/src/setup-mpc-common .
RUN yarn link
WORKDIR /usr/src/setup-mpc-client
COPY --from=1 /usr/src/setup-mpc-client .
RUN yarn link
WORKDIR /usr/src/setup-mpc-web
COPY . .
RUN yarn install && yarn build && rm -rf node_modules && yarn install --production && yarn cache clean
CMD ["yarn", "start"]