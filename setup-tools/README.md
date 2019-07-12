# AZTEC Protocol Trusted Setup Repository

**THIS CODE IS HIGHLY EXPERIMENTAL AND HAS NOT BEEN THOROUGHLY TESTED, USE AT YOUR OWN RISK!**

This repo contains compiles several C++ executables that run the AZTEC trusted setup ceremony.

- **setup** will perform one round of the trusted setup MPC, updating a proof transcript in `build/setup_db`
- **compute_generator_polynomial** will compute the polynomial coefficients required to construct the AZTEC generator point `h`, from the results of **setup**, and write coefficients into `build/post_processing_db`
- **compute_range_polynomials** will compute the AZTEC signature points `mu_k`, from the results of **setup** and **compute_generator_polynomial**, and write a db file to `build/post_processing_db`

The common reference string produced by `setup` can also be used to construct structured reference strings for [SONIC zk-SNARKS](https://eprint.iacr.org/2019/099.pdf)

## Install Instructions

To build:
`docker build -t aztec/setup-tools .`

This creates a docker image with the executables located in `/usr/src/app/build`.

## Development

To ease development you can use the image above as a build environment, with your current source code mounted into the conatiner.

`docker-compose run build-env`

Once in the container you can rebuild executables from your modified source code on the host:

```
cd ./build
make
```
