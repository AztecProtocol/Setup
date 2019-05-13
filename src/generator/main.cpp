#include <libff/algebra/curves/alt_bn128/alt_bn128_pp.hpp>

#include <stdio.h>

#include "compute_generator_polynomial.hpp"

int main()
{
    printf("initializing libff \n");
    libff::alt_bn128_pp::init_public_params();
    printf("calling compute generator poly \n");
    generator::compute_generator_polynomial<libff::Fr<libff::alt_bn128_pp>, 0x100000>();
    return true;
}