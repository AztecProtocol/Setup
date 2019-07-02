FROM aztec/trusted-setup
RUN apt-get install -y parallel redis-tools
WORKDIR /usr/src/runner
COPY . .
CMD ./run