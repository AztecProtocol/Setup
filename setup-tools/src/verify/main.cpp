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
        std::cout << "usage: " << argv[0] << " <transcript path> <transcript 0 path>" << std::endl;
        return 1;
    }
    std::string const transcript_path(argv[1]);
    std::string const transcript0_path(argv[2]);

    libff::alt_bn128_pp::init_public_params();

    if (!streaming::is_file_exist(transcript_path))
    {
        std::cout << "Transcript not found: " << transcript_path << std::endl;
        return 1;
    }
    if (!streaming::is_file_exist(transcript0_path))
    {
        std::cout << "Transcript 0 not found: " << transcript0_path << std::endl;
        return 1;
    }

    using Fq = libff::Fq<libff::alt_bn128_pp>;
    using G1 = libff::G1<libff::alt_bn128_pp>;
    using G2 = libff::G2<libff::alt_bn128_pp>;

    try
    {
        streaming::Manifest manifest;
        std::vector<G1> g1_x;
        std::vector<G2> g2_x;
        G1 g1_0;
        G2 g2_0;

        streaming::read_transcript_0_point<Fq>(g1_0, g2_0, transcript0_path);
        streaming::read_transcript<Fq>(g1_x, g2_x, manifest, transcript_path);

        std::cout << "Verifying..." << std::endl;
        bool result = verifier::validate_transcript<libff::alt_bn128_pp>(g1_x, g2_x, g1_0, g2_0);

        std::cout << (result ? "Success." : "Failed.") << std::endl;

        return result ? 0 : 1;
    }
    catch (std::exception const &err)
    {
        std::cerr << err.what() << std::endl;
        return 1;
    }
}