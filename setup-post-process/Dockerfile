FROM aztec/trusted-setup
RUN apt-get install -y parallel redis-tools curl
WORKDIR /usr/src/app/build
ENV POLYNOMIAL_DEGREE 0x100000
RUN ./setup $POLYNOMIAL_DEGREE && ./compute_generator_polynomial $POLYNOMIAL_DEGREE
WORKDIR /usr/src/runner
COPY . .
CMD ./run