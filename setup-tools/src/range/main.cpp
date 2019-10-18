/**
 * Setup
 * Copyright Spilsbury Holdings 2019
 **/
#include <iostream>
#include "range_multi_exp.hpp"

int main(int argc, char **argv)
{
    if (argc < 5)
    {
        std::cout << "usage: " << argv[0] << " <generator path> <g1x path> <index to compute> <kmax> <batches>" << std::endl;
        return 1;
    }
    const std::string generator_path = argv[1];
    const std::string g1x_path = argv[2];
    const size_t range_index = (size_t)atoi(argv[3]);
    const size_t kmax = strtol(argv[4], NULL, 0);
    const size_t batches = argc > 5 ? strtol(argv[5], NULL, 0) : 4;

    compute_range_polynomials(generator_path, g1x_path, range_index, kmax + 1, batches);
    return 0;
}