#FROM 278380418400.dkr.ecr.eu-west-2.amazonaws.com/setup-tools:latest
FROM aztec/setup-tools:latest
FROM node:10
WORKDIR /usr/src/app
COPY --from=0 /usr/src/app/build/setup .
COPY package.json .
RUN yarn install
COPY . .
RUN yarn tsc
CMD [ "node", "./dest"]