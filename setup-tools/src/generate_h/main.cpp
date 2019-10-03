/**
 * Setup
 * Copyright Spilsbury Holdings 2019
 **/
#include <libff/algebra/curves/alt_bn128/alt_bn128_pp.hpp>
#include <stdio.h>
#include "range_multi_exp.hpp"

int main(int argc, char **argv)
{
    if (argc != 3)
    {
        std::cout << "usage: " << argv[0] << " <setup db path> <generator path>" << std::endl;
        return 1;
    }
    const std::string setup_db_path = argv[1];
    const std::string generator_path = argv[2];

    libff::alt_bn128_pp::init_public_params();

    try
    {
        generate_h::compute_h(setup_db_path, generator_path);
    }
    catch (std::exception const &e)
    {
        std::cerr << e.what() << std::endl;
        return 1;
    }
    return 0;
}