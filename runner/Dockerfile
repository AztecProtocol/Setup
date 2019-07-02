FROM aztec/trusted-setup
RUN apt-get install -y parallel redis-tools curl
WORKDIR /usr/src/app/build
RUN ./setup 0x10000 && ./compute_generator_polynomial
WORKDIR /usr/src/runner
COPY . .
CMD ./run