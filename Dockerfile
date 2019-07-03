FROM ubuntu:latest
RUN apt-get update && apt-get install -y build-essential git libboost-all-dev cmake libgmp3-dev pkg-config openssl libssl-dev
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
COPY . .
RUN git submodule init && git submodule update
RUN mkdir build && cd build && cmake .. && make -j8