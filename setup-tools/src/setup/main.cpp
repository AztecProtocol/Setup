/**
 * Setup
 * Copyright Spilsbury Holdings 2019
 *
 **/
#include <libff/algebra/curves/alt_bn128/alt_bn128_pp.hpp>

#include <stdio.h>

#include "setup.hpp"

int main(int argc, char **argv)
{
    const size_t polynomial_degree_aztec = argc > 1 ? strtol(argv[1], NULL, 0) : setup::POLYNOMIAL_DEGREE_AZTEC;
    printf("initializing libff \n");
    libff::alt_bn128_pp::init_public_params();
    printf("attempting to generate setup variables %zu\n", polynomial_degree_aztec);
    setup::run_setup<libff::alt_bn128_pp>(polynomial_degree_aztec);

    return 0;
}