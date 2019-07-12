FROM 278380418400.dkr.ecr.eu-west-2.amazonaws.com/setup-tools:latest
RUN apt-get install -y curl
WORKDIR /usr/src/app
ENV POLYNOMIAL_DEGREE 0xA00000
RUN mkdir setup_db post_processing_db && \
  curl https://trusted-setup-data.s3.eu-west-2.amazonaws.com/g1_x_current.dat > ./setup_db/g1_x_current.dat && \
  curl https://trusted-setup-data.s3.eu-west-2.amazonaws.com/generator.dat > ./post_processing_db/generator.dat
WORKDIR /usr/src/runner
COPY . .
CMD ./run