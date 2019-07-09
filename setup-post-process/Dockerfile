FROM 278380418400.dkr.ecr.eu-west-2.amazonaws.com/setup-tools:latest
RUN apt-get install -y curl
WORKDIR /usr/src/app/build
ENV POLYNOMIAL_DEGREE 0x100000
RUN ./setup $POLYNOMIAL_DEGREE && ./compute_generator_polynomial $POLYNOMIAL_DEGREE
WORKDIR /usr/src/runner
COPY . .
CMD ./run