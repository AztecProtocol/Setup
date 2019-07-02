/**
 * Setup
 * Copyright Spilsbury Holdings 2019
 *
 **/
#include <libff/algebra/curves/alt_bn128/alt_bn128_pp.hpp>

#include <stdio.h>

#include "range_multi_exp.hpp"

int main(int argc, char **argv)
{
    if (argc != 2)
    {
        printf("error! expected 1 input argument, got %d\n", argc - 1);
    }
    size_t range_index = (size_t)atoi(argv[1]);

    libff::alt_bn128_pp::init_public_params();

    range::compute_range_polynomials<libff::alt_bn128_pp>(range_index);
    return true;
}