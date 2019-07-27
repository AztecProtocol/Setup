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
    if (argc < 2)
    {
        std::cout << "usage: " << argv[0] << " <transcript path>" << std::endl;
        return 1;
    }
    std::string transcript_path(argv[1]);

    libff::alt_bn128_pp::init_public_params();

    if (!streaming::is_file_exist(transcript_path))
    {
        std::cout << "Transcript not found: " << transcript_path << std::endl;
        return 1;
    }

    using Fq = libff::Fq<libff::alt_bn128_pp>;
    using G1 = libff::G1<libff::alt_bn128_pp>;
    using G2 = libff::G2<libff::alt_bn128_pp>;

    try
    {
        std::vector<G1> g1_x;
        std::vector<G2> g2_x;
        streaming::Manifest manifest;

        streaming::read_transcript<Fq>(g1_x, g2_x, manifest, transcript_path);

        std::cout << "Verifying..." << std::endl;
        bool result = verifier::validate_transcript<libff::alt_bn128_pp>(&g1_x[0], &g2_x[0], g1_x.size());

        std::cout << (result ? "Success." : "Failed.") << std::endl;

        return result ? 0 : 1;
    }
    catch (std::exception const &err)
    {
        std::cerr << err.what() << std::endl;
        return 1;
    }
}