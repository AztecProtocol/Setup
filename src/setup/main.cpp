#include <libff/algebra/curves/alt_bn128/alt_bn128_pp.hpp>

#include <stdio.h>

#include "setup.hpp"

int main()
{
    printf("initializing libff \n");
    libff::alt_bn128_pp::init_public_params();
    printf("attempting to generate setup variables \n");
    // range::compute_range_polynomials_b<libff::Fr<libff::alt_bn128_pp>, 0x100000>(1, 2);
    setup::run_setup<libff::Fq<libff::alt_bn128_pp>, libff::Fqe<libff::alt_bn128_pp>, libff::Fr<libff::alt_bn128_pp>, libff::G1<libff::alt_bn128_pp>, libff::G2<libff::alt_bn128_pp> >();

    return true;
}