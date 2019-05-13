#include <libff/algebra/curves/alt_bn128/alt_bn128_pp.hpp>

#include <stdio.h>

#include "compute_range_polynomial.hpp"

int main()
{
    printf("initializing libff \n");
    libff::alt_bn128_pp::init_public_params();
    printf("calling compute range poly \n");
    // range::compute_range_polynomials_b<libff::Fr<libff::alt_bn128_pp>, 0x100000>(1, 2);
    range::compute_range_polynomials<libff::Fr<libff::alt_bn128_pp>, 0x100000>(0, 0x1000);

    return true;
}