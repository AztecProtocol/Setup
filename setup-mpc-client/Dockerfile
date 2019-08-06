FROM 278380418400.dkr.ecr.eu-west-2.amazonaws.com/setup-tools:latest
FROM 278380418400.dkr.ecr.eu-west-2.amazonaws.com/setup-mpc-common:latest

FROM node:10
WORKDIR /usr/src/setup-mpc-common
COPY --from=1 /usr/src/setup-mpc-common .
RUN yarn link
WORKDIR /usr/src/setup-mpc-client
COPY . .
RUN yarn install && yarn build && rm -rf node_modules && yarn install --production

FROM ubuntu:latest
RUN apt update && \
  apt install -y curl && \
  curl -sL https://deb.nodesource.com/setup_10.x | bash - && \
  curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add - && \
  echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list && \
  apt update && \
  apt install -y nodejs yarn && \
  apt clean
COPY --from=0 /usr/src/setup-tools/setup /usr/src/setup-tools/setup
RUN mkdir /usr/src/setup_db
WORKDIR /usr/src/setup-mpc-common
COPY --from=1 /usr/src/setup-mpc-common .
RUN yarn link
WORKDIR /usr/src/setup-mpc-client
COPY --from=2 /usr/src/setup-mpc-client .
RUN yarn link setup-mpc-common
CMD ["yarn", "start"]