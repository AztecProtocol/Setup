FROM 278380418400.dkr.ecr.eu-west-2.amazonaws.com/setup-mpc-common:latest

FROM node:10
WORKDIR /usr/src/setup-mpc-common
COPY --from=1 /usr/src/setup-mpc-common .
RUN yarn link
WORKDIR /usr/src/setup-mpc-client
COPY package.json yarn.lock ./
RUN yarn install
COPY . .
RUN yarn build
CMD ["yarn", "--silent", "start"]