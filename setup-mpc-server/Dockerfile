#FROM node:10
#WORKDIR /usr/src/app
#COPY package.json .
#RUN yarn install && yarn cache clean
#CMD ["yarn", "start"]
#COPY . .
#FROM 278380418400.dkr.ecr.eu-west-2.amazonaws.com/setup-tools:latest
FROM aztec/setup-tools:latest
FROM ubuntu:latest
RUN apt update && \
  apt install -y curl && \
  curl -sL https://deb.nodesource.com/setup_10.x | bash - && \
  curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add - && \
  echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list && \
  apt update && \
  apt install -y nodejs yarn make g++ && \
  apt clean
COPY --from=0 /usr/src/app/build/verify /usr/src/setup-tools/verify
COPY setup-mpc-common /usr/src/setup-mpc-common
WORKDIR /usr/src/setup-mpc-server
COPY setup-mpc-server .
RUN yarn install && yarn build && rm -rf node_modules && yarn install --production && yarn cache clean
CMD [ "node", "./dest"]