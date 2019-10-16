/**
 * Setup
 * Copyright Spilsbury Holdings 2019
 **/
#include <iostream>
#include "range_multi_exp.hpp"

int main(int argc, char **argv)
{
    if (argc < 4)
    {
        std::cout << "usage: " << argv[0] << " <setup db path> <index to compute> <polynomial degree> <batches>" << std::endl;
        return 1;
    }
    const std::string setup_db_path = argv[1];
    const size_t range_index = (size_t)atoi(argv[2]);
    const size_t polynomial_degree = strtol(argv[3], NULL, 0);
    const size_t batches = argc > 4 ? strtol(argv[4], NULL, 0) : 4;

    compute_range_polynomials(setup_db_path, range_index, polynomial_degree, batches);
    return 0;
}