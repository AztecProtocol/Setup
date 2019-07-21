#FROM 278380418400.dkr.ecr.eu-west-2.amazonaws.com/setup-tools:latest
FROM aztec/setup-tools
RUN apt-get install -y curl
WORKDIR /usr/src/app/build
ENV POLYNOMIAL_DEGREE 0xA00000
RUN ./compute_generator_polynomial $POLYNOMIAL_DEGREE
RUN curl -f https://trusted-setup-data.s3.eu-west-2.amazonaws.com/transcript.dat > ../setup_db/transcript.dat
RUN ./prep_range_data $POLYNOMIAL_DEGREE

FROM alpine:latest
WORKDIR /usr/src/app/build
COPY --from=0 /usr/src/app/build/compute_range_polynomial .
WORKDIR /usr/src/app/setup_db
COPY --from=0 /usr/src/app/setup_db/generator_prep.dat .
COPY --from=0 /usr/src/app/setup_db/g1_x_prep.dat .
ENV POLYNOMIAL_DEGREE 0xA00000
WORKDIR /usr/src/runner
COPY . .
CMD ./run