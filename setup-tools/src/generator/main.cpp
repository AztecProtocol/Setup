/**
 * Setup
 * Copyright Spilsbury Holdings 2019
 *
 **/
#include <libff/algebra/curves/alt_bn128/alt_bn128_pp.hpp>

#include "compute_generator_polynomial.hpp"

namespace
{
constexpr size_t POLYNOMIAL_DEGREE = 0x10000;
}

int main(int argc, char **argv)
{
    const size_t polynomial_degree = argc > 1 ? strtol(argv[1], NULL, 0) : POLYNOMIAL_DEGREE;
    printf("initializing libff \n");
    libff::alt_bn128_pp::init_public_params();
    printf("calling compute generator poly \n");
    std::vector<libff::alt_bn128_Fr> coefficients = generator::compute_generator_polynomial<libff::Fr<libff::alt_bn128_pp>>(polynomial_degree);
    printf("computed polynomial coefficients, writing to disk...\n");
    streaming::write_field_elements_to_file(coefficients, "../setup_db/generator.dat");

    return 0;
}