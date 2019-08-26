/**
 * Setup
 * Copyright Spilsbury Holdings 2019
 **/
#include <libff/algebra/curves/alt_bn128/alt_bn128_pp.hpp>

#include <stdio.h>

#include "setup.hpp"

int main(int argc, char **argv)
{
#ifndef SIMULATE_PARTICIPANT
    if (argc < 2 || argc > 4)
    {
        std::cerr << "usage: " << argv[0] << " <transcript dir> [<initial num g1 points> <initial num g2 points>]" << std::endl;
        return 1;
    }
    std::string const dir = argv[1];

    size_t num_g1_points = (argc >= 3) ? strtol(argv[2], NULL, 0) : 0;
    size_t num_g2_points = (argc == 4) ? strtol(argv[3], NULL, 0) : 1;
    size_t num_setup_files = (size_t)-1; // only used for simulated participants
#else
    if (argc < 3 || argc > 5)
    {
        std::cerr << "usage: " << argv[0] << " <transcript dir> <num_files> [<initial num g1 points> <initial num g2 points>]" << std::endl;
        return 1;
    }
    std::string const dir = argv[1];
    size_t num_setup_files = strtol(argv[2], NULL, 0);
    size_t num_g1_points = (argc >= 4) ? strtol(argv[3], NULL, 0) : 0;
    size_t num_g2_points = (argc == 5) ? strtol(argv[4], NULL, 0) : 1;
#endif

    libff::alt_bn128_pp::init_public_params();

    try
    {
        run_setup(dir, num_g1_points, num_g2_points, num_setup_files);
    }
    catch (std::exception const &err)
    {
        std::cerr << err.what() << std::endl;
        return 1;
    }

    return 0;
}