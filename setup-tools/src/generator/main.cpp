/**
 * Setup
 * Copyright Spilsbury Holdings 2019
 *
 **/
#include <libff/algebra/curves/alt_bn128/alt_bn128_pp.hpp>

#include "compute_generator_polynomial.hpp"

int main(int argc, char **argv)
{
    if (argc != 3)
    {
        std::cout << "usage: " << argv[0] << " <setup db path> <polynomial degree>" << std::endl;
        return 1;
    }
    const std::string setup_db_path = argv[1];
    const size_t polynomial_degree = strtol(argv[2], NULL, 0);

    printf("initializing libff \n");
    libff::alt_bn128_pp::init_public_params();
    printf("calling compute generator poly \n");
    std::vector<libff::alt_bn128_Fr> coefficients = generator::compute_generator_polynomial<libff::Fr<libff::alt_bn128_pp>>(polynomial_degree);
    printf("computed polynomial coefficients, writing to disk...\n");
    streaming::write_field_elements_to_file(coefficients, setup_db_path + "/generator.dat");

    return 0;
}