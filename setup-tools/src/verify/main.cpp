/**
 * Setup
 * Copyright Spilsbury Holdings 2019
 **/
#include <libff/algebra/curves/alt_bn128/alt_bn128_pp.hpp>
#include <stdio.h>
#include <iostream>
#include <aztec_common/streaming.hpp>
#include "verifier.hpp"

bool is_file_exist(const char *fileName)
{
    std::ifstream infile(fileName);
    return infile.good();
}

int main(int argc, char **argv)
{
    if (argc < 4)
    {
        std::cout << "usage: " << argv[0] << " <g1 path> <g2 path> <polynomials>" << std::endl;
        return 1;
    }
    const char *g1_path = argv[1];
    const char *g2_path = argv[2];
    const size_t polynomial_degree = strtol(argv[3], NULL, 0);

    printf("initializing libff \n");
    libff::alt_bn128_pp::init_public_params();

    if (!is_file_exist(g1_path) || !is_file_exist(g2_path))
    {
        std::cout << "File not found." << std::endl;
        return 1;
    }

    using Fq = libff::Fq<libff::alt_bn128_pp>;
    using G1 = libff::G1<libff::alt_bn128_pp>;
    using G2 = libff::G2<libff::alt_bn128_pp>;

    const size_t G1_BUFFER_SIZE_AZTEC = sizeof(Fq) * 2 * polynomial_degree;
    const size_t G2_BUFFER_SIZE_SONIC = sizeof(Fq) * 4 * polynomial_degree;

    G1 *g1_x = (G1 *)malloc(polynomial_degree * sizeof(G1));
    G2 *g2_x = (G2 *)malloc(polynomial_degree * sizeof(G2));
    char *read_write_buffer = (char *)malloc(G2_BUFFER_SIZE_SONIC + checksum::BLAKE2B_CHECKSUM_LENGTH);

    std::cout << "Reading transcripts..." << std::endl;
    streaming::read_file_into_buffer("../setup_db/g1_x_current.dat", read_write_buffer, G1_BUFFER_SIZE_AZTEC);
    streaming::read_g1_elements_from_buffer<Fq, G1>(&g1_x[0], read_write_buffer, G1_BUFFER_SIZE_AZTEC);
    streaming::validate_checksum(read_write_buffer, G1_BUFFER_SIZE_AZTEC);

    streaming::read_file_into_buffer("../setup_db/g2_x_current.dat", read_write_buffer, G2_BUFFER_SIZE_SONIC);
    streaming::read_g2_elements_from_buffer<Fq, G2>(&g2_x[0], read_write_buffer, G2_BUFFER_SIZE_SONIC);
    streaming::validate_checksum(read_write_buffer, G2_BUFFER_SIZE_SONIC);

    std::cout << "Verifying..." << std::endl;
    bool result = verifier::validate_transcript<libff::alt_bn128_pp>(&g1_x[0], &g2_x[0], polynomial_degree);

    std::cout << (result ? "Success." : "Failed.") << std::endl;

    return result ? 0 : 1;
}