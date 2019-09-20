/**
 * Setup
 * Copyright Spilsbury Holdings 2019
 **/
#include <libff/algebra/curves/alt_bn128/alt_bn128_pp.hpp>
#include <stdio.h>
#include "range_multi_exp.hpp"

int main(int argc, char **argv)
{
    if (argc != 3)
    {
        std::cout << "usage: " << argv[0] << " <index to compute> <polynomial degree>" << std::endl;
        return 1;
    }
    const size_t range_index = (size_t)atoi(argv[1]);
    const size_t polynomial_degree = strtol(argv[2], NULL, 0);

    libff::alt_bn128_pp::init_public_params();

    compute_range_polynomials(range_index, polynomial_degree);
    return 0;
}