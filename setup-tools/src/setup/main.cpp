/**
 * Setup
 * Copyright Spilsbury Holdings 2019
 **/
#include <libff/algebra/curves/alt_bn128/alt_bn128_pp.hpp>

#include <stdio.h>

#include "setup.hpp"

int main(int argc, char **argv)
{
    if (argc < 2)
    {
        std::cerr << "usage: " << argv[0] << " <transcript dir> <num g1 points> <num g2 points>" << std::endl;
        return 1;
    }
    std::string const dir = argv[1];

    size_t num_g1_points = (argc == 3) ? strtol(argv[2], NULL, 0) : 0;
    size_t num_g2_points = (argc == 4) ? strtol(argv[3], NULL, 0) : 1;

    libff::alt_bn128_pp::init_public_params();

    try
    {
        run_setup<libff::alt_bn128_pp>(dir, num_g1_points, num_g2_points);
    }
    catch (std::exception const &err)
    {
        std::cerr << err.what() << std::endl;
        return 1;
    }

    return 0;
}