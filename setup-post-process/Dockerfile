#FROM 278380418400.dkr.ecr.eu-west-2.amazonaws.com/setup-tools:latest
FROM aztec/setup-tools
RUN apt-get install -y curl
WORKDIR /usr/src/app
ENV POLYNOMIAL_DEGREE 0xA00000
#RUN curl https://trusted-setup-data.s3.eu-west-2.amazonaws.com/g1_x_current.dat > ./setup_db/g1_x_current.dat && \
#  curl https://trusted-setup-data.s3.eu-west-2.amazonaws.com/generator.dat > ./post_processing_db/generator.dat
COPY ./post_processing_db/*_prep.dat ./post_processing_db/
WORKDIR /usr/src/runner
COPY . .
CMD ./run