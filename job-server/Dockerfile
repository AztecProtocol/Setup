FROM node:10
WORKDIR /usr/src/app
COPY package.json .
RUN yarn install && yarn cache clean
CMD ["yarn", "start"]
COPY . .