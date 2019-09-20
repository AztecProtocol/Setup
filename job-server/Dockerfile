FROM node:10-alpine
WORKDIR /usr/src/job-server
COPY . .
RUN yarn install && yarn build && rm -rf node_modules && yarn install --production && yarn cache clean
CMD ["yarn", "start"]