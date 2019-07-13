/**
 * Setup
 * Copyright Spilsbury Holdings 2019
 *
 **/
#include <libff/algebra/curves/alt_bn128/alt_bn128_pp.hpp>

#include <stdio.h>

#include "range_multi_exp.hpp"

constexpr size_t POLYNOMIAL_DEGREE = 0x10000;

int main(int argc, char **argv)
{
    if (argc < 2)
    {
        printf("usage: %s <index to compute> [polynomial degree]", argv[0]);
    }
    const size_t range_index = (size_t)atoi(argv[1]);
    const size_t polynomial_degree = argc > 2 ? strtol(argv[2], NULL, 0) : POLYNOMIAL_DEGREE;

    libff::alt_bn128_pp::init_public_params();

    compute_range_polynomials<libff::alt_bn128_pp>(range_index, polynomial_degree);
    return 0;
}