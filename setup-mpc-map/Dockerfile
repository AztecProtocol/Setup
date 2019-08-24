FROM 278380418400.dkr.ecr.eu-west-2.amazonaws.com/setup-mpc-common:latest

FROM node:10-alpine
WORKDIR /usr/src/setup-mpc-common
COPY --from=0 /usr/src/setup-mpc-common .
RUN yarn link
WORKDIR /usr/src/setup-mpc-map
COPY . .
RUN yarn install && yarn build && rm -rf node_modules && yarn install --production && yarn cache clean
CMD ["yarn", "start"]