/**
 * Setup
 * Copyright Spilsbury Holdings 2019
 **/
#include <libff/algebra/curves/alt_bn128/alt_bn128_pp.hpp>
#include <stdio.h>
#include <iostream>
#include <memory>
#include <aztec_common/streaming.hpp>
#include "verifier.hpp"

int main(int argc, char **argv)
{
    if (argc < 3)
    {
        std::cout << "usage: " << argv[0] << " <transcript path> <polynomials>" << std::endl;
        return 1;
    }
    const char *transcript_path = argv[1];
    const size_t polynomial_degree = strtol(argv[2], NULL, 0);

    libff::alt_bn128_pp::init_public_params();

    if (!streaming::is_file_exist(transcript_path))
    {
        std::cout << "Transcript not found." << std::endl;
        return 1;
    }

    using Fq = libff::Fq<libff::alt_bn128_pp>;
    using G1 = libff::G1<libff::alt_bn128_pp>;
    using G2 = libff::G2<libff::alt_bn128_pp>;

    try
    {
        std::vector<G1> g1_x(polynomial_degree);
        std::vector<G2> g2_x(polynomial_degree);

        streaming::read_transcript<Fq>(g1_x, g2_x, transcript_path);

        std::cout << "Verifying..." << std::endl;
        bool result = verifier::validate_transcript<libff::alt_bn128_pp>(&g1_x[0], &g2_x[0], polynomial_degree);

        std::cout << (result ? "Success." : "Failed.") << std::endl;

        return result ? 0 : 1;
    }
    catch (std::exception const &err)
    {
        std::cerr << err.what() << std::endl;
        return 1;
    }
}