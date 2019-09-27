/**
 * Setup
 * Copyright Spilsbury Holdings 2019
 **/
#include <libff/algebra/curves/alt_bn128/alt_bn128_pp.hpp>

#include <stdio.h>
#include <sys/types.h>
#include <sys/stat.h>

#include "setup.hpp"

int main(int argc, char **argv)
{
    if (argc < 2 || argc > 4)
    {
        std::cerr << "usage: " << argv[0] << " <transcript dir> [<initial num g1 points> <initial num g2 points>]" << std::endl;
        return 1;
    }
    std::string const dir = argv[1];

    libff::alt_bn128_pp::init_public_params();

    try
    {
        struct stat info;
        if (stat(dir.c_str(), &info) != 0)
        {
            throw std::runtime_error("Transcript directory not found.");
        }

#ifdef SEALING
        seal(dir);
#else
        size_t num_g1_points = (argc >= 3) ? strtol(argv[2], NULL, 0) : 0;
        size_t num_g2_points = (argc == 4) ? strtol(argv[3], NULL, 0) : 1;

        run_setup(dir, num_g1_points, num_g2_points);
#endif
    }
    catch (std::exception const &err)
    {
        std::cerr << err.what() << std::endl;
        return 1;
    }

    return 0;
}