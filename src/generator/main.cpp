#include <libff/algebra/curves/alt_bn128/alt_bn128_pp.hpp>

#include "compute_generator_polynomial.hpp"

namespace
{
    constexpr size_t POLYNOMIAL_DEGREE = 0x2000;
}

int main()
{
    printf("initializing libff \n");
    libff::alt_bn128_pp::init_public_params();
    printf("calling compute generator poly \n");
    generator::compute_generator_polynomial<libff::Fr<libff::alt_bn128_pp>, POLYNOMIAL_DEGREE>();
    return true;
}