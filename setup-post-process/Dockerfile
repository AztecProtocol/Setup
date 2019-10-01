FROM 278380418400.dkr.ecr.eu-west-2.amazonaws.com/setup-tools:latest
FROM ubuntu:latest
RUN apt update && apt install -y curl jq
COPY --from=0 /usr/src/setup-tools/prep_range_data /usr/src/setup-tools/prep_range_data
COPY --from=0 /usr/src/setup-tools/compute_range_polynomial /usr/src/setup-tools/compute_range_polynomial
WORKDIR /usr/src/setup-post-process
COPY . .
CMD ./run