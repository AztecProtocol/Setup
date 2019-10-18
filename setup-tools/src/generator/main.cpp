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
        std::cout << "usage: " << argv[0] << " <kmax> <output>" << std::endl;
        return 1;
    }
    const size_t kmax = strtol(argv[1], NULL, 0);
    const std::string output = argv[2];

    printf("initializing libff \n");
    libff::alt_bn128_pp::init_public_params();
    printf("calling compute generator poly \n");
    std::vector<libff::alt_bn128_Fr> coefficients = generator::compute_generator_polynomial<libff::Fr<libff::alt_bn128_pp>>(kmax);
    printf("computed polynomial coefficients, writing to disk...\n");

    // Write the data out in memory format. Assumes this is run on the same arch as compute_range_polynomial.
    std::ofstream file(output);
    file.write((char *)&coefficients[0], coefficients.size() * sizeof(Fr));

    return 0;
}