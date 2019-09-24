# specify the node base image with your desired version node:<version>
FROM gcc:latest
# replace this with your application's default port
RUN apt-get -qq update
RUN mkdir /src
## Specify the "working directory" for the rest of the Dockerfile
WORKDIR /src
COPY . /src
RUN apt-get install build-essential git libboost-all-dev cmake libgmp3-dev libssl-dev pkg-config -y
RUN mkdir build
RUN cd build && cmake .. -DDOCKER=ON
RUN cd build && make
EXPOSE 4000 
WORKDIR /src/build
CMD ["./compute_range_polynomial"]
