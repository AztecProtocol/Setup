/**
 * Setup
 * Copyright Spilsbury Holdings 2019
 **/
#include <libff/algebra/curves/alt_bn128/alt_bn128_pp.hpp>
#include <stdio.h>
#include "range_multi_exp.hpp"

int main(int argc, char **argv)
{
    if (argc < 4)
    {
        std::cout << "usage: " << argv[0] << " <generator path> <g1x path> <kmax> [batches]" << std::endl;
        return 1;
    }
    const std::string generator_path = argv[1];
    const std::string g1x_path = argv[2];
    const size_t kmax = strtol(argv[3], NULL, 0);
    const size_t batches = argc > 4 ? strtol(argv[4], NULL, 0) : 4;

    libff::alt_bn128_pp::init_public_params();

    try
    {
        generate_h::compute_h(generator_path, g1x_path, kmax + 1, batches);
    }
    catch (std::exception const &e)
    {
        std::cerr << e.what() << std::endl;
        return 1;
    }
    return 0;
}