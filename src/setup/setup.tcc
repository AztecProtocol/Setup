/**
 * Setup
 * Copyright Spilsbury Holdings 2019
 * 
 **/
#include <string.h>
#include <stdlib.h>
#include <iostream>
#include <stdio.h>
#include <string.h>

// #include <libff/algebra/scalar_multiplication/multiexp.hpp>
#include <libff/common/profiling.hpp>
#include <libff/common/utils.hpp>
#include <libff/algebra/curves/public_params.hpp>
#include <libff/algebra/curves/curve_utils.hpp>
#include <libff/algebra/scalar_multiplication/wnaf.hpp>

#include <aztec_common/assert.hpp>
#include <aztec_common/checksum.hpp>
#include <aztec_common/streaming.hpp>

#include "utils.hpp"
#include "verifier.hpp"

#define VERIFY_TRANSCRIPT 0

namespace setup
{
namespace
{
    constexpr size_t WNAF_WINDOW_SIZE = 5;

bool is_file_exist(const char *fileName)
{
    std::ifstream infile(fileName);
    return infile.good();
}
} // namespace

std::string create_file_name(size_t k)
{
    std::stringstream ss;
    ss << "./range_" << k << ".dat";
    return ss.str();
}

template <typename ppT> void run_setup()
{
    using Fr = libff::Fr<ppT>;
    using Fq = libff::Fq<ppT>;
    using Fqe = libff::Fqe<ppT>;
    using G1 = libff::G1<ppT>;
    using G2 = libff::G2<ppT>;

    constexpr size_t num_limbs = sizeof(Fq) / GMP_NUMB_BYTES;
    constexpr size_t G1_BUFFER_SIZE = sizeof(Fq) * 2 * POLYNOMIAL_DEGREE;
    constexpr size_t G2_BUFFER_SIZE = sizeof(Fq) * 4 * POLYNOMIAL_DEGREE;

    printf("inside run setup\n");

    // our toxic waste... we must ensure this is wiped before this function goes out of scope!
    Fr accumulator = Fr::random_element();
    Fr multiplicand = accumulator;
    Fr alpha = Fr::random_element();

    printf("allocating memory\n");

    // set up our point arrays
    G1* g1_x = (G1*)malloc(POLYNOMIAL_DEGREE * sizeof(G1));
    G1* g1_alpha_x = (G1*)malloc(POLYNOMIAL_DEGREE * sizeof(G1));
    G2* g2_x = (G2*)malloc(POLYNOMIAL_DEGREE * sizeof(G2));
    G2* g2_alpha_x = (G2*)malloc(POLYNOMIAL_DEGREE * sizeof(G2));
    // set up our read write buffer
    char* read_write_buffer = (char*)malloc(G2_BUFFER_SIZE + checksum::BLAKE2B_CHECKSUM_LENGTH);


    if (is_file_exist("./setup_db/g1_x_current.dat"))
    {
        printf("previous setup transcript found, reading from disk...\n");
        streaming::read_file_into_buffer("./setup_db/g1_x_current.dat", read_write_buffer, G1_BUFFER_SIZE);
        streaming::read_g1_elements_from_buffer<Fq, G1>(&g1_x[0], read_write_buffer, G1_BUFFER_SIZE);
        streaming::validate_checksum(read_write_buffer, G1_BUFFER_SIZE);

        streaming::read_file_into_buffer("./setup_db/g1_alpha_x_current.dat", read_write_buffer, G1_BUFFER_SIZE);
        streaming::read_g1_elements_from_buffer<Fq, G1>(&g1_alpha_x[0], read_write_buffer, G1_BUFFER_SIZE);
        streaming::validate_checksum(read_write_buffer, G1_BUFFER_SIZE);

        streaming::read_file_into_buffer("./setup_db/g2_x_current.dat", read_write_buffer, G2_BUFFER_SIZE);
        streaming::read_g2_elements_from_buffer<Fq, G2>(&g2_x[0], read_write_buffer, G2_BUFFER_SIZE);
        streaming::validate_checksum(read_write_buffer, G2_BUFFER_SIZE);

        streaming::read_file_into_buffer("./setup_db/g2_alpha_x_current.dat", read_write_buffer, G2_BUFFER_SIZE);
        streaming::read_g2_elements_from_buffer<Fq, G2>(&g2_alpha_x[0], read_write_buffer, G2_BUFFER_SIZE);
        streaming::validate_checksum(read_write_buffer, G2_BUFFER_SIZE);

#if VERIFY_TRANSCRIPT > 0
        printf("verifying previous transcript...\n");
        bool result = verifier::validate_transcript<ppT>(&g1_x[0], &g1_alpha_x[0], &g2_x[0], &g2_alpha_x[0], POLYNOMIAL_DEGREE);
        printf("transcript result = %d\n", (int)result);
        ASSERT(result == true);
#endif
    }
    else
    {
        printf("could not find previous setup transcript, creating initial transcript...\n");
        for (size_t i = 0; i < POLYNOMIAL_DEGREE; ++i)
        {
            if (i % 100000 == 0)
            {
                printf("i = %d\n", (int)i);
            }
            g1_x[i] = G1::one();
            g1_alpha_x[i] = G1::one();
            g2_x[i] = G2::one();
            g2_alpha_x[i] = G2::one();
        }
    }

    printf("initialized setup polynomials, updating setup transcript...\n");
    for (size_t i = 0; i < POLYNOMIAL_DEGREE; ++i)
    {
        if (i % 1000 == 0)
        {
            printf("group element i = %d\n", (int)i);
        }
        libff::bigint<num_limbs> x_bigint = accumulator.as_bigint();
        libff::bigint<num_limbs> alpha_x_bigint = (alpha * accumulator).as_bigint();
        g1_x[i] = libff::fixed_window_wnaf_exp<G1, num_limbs>(WNAF_WINDOW_SIZE, g1_x[i], x_bigint);
        g1_alpha_x[i] = libff::fixed_window_wnaf_exp<G1, num_limbs>(WNAF_WINDOW_SIZE, g1_alpha_x[i], alpha_x_bigint);
        g2_x[i] = libff::fixed_window_wnaf_exp<G2, num_limbs>(WNAF_WINDOW_SIZE, g2_x[i], x_bigint);
        g2_alpha_x[i] = libff::fixed_window_wnaf_exp<G2, num_limbs>(WNAF_WINDOW_SIZE, g2_alpha_x[i], alpha_x_bigint);

        accumulator = accumulator * multiplicand;
    }

    printf("updated setup transcript, converting points into affine form...\n");
    utils::batch_normalize<Fq, G1>(0, POLYNOMIAL_DEGREE, &g1_x[0], &g1_alpha_x[0]);
    utils::batch_normalize<Fqe, G2>(0, POLYNOMIAL_DEGREE, &g2_x[0], &g2_alpha_x[0]);

    printf("writing setup transcript to disk...\n");
    std::rename("./setup_db/g1_x_current.dat", "./setup_db/g1_x_previous.dat");
    std::rename("./setup_db/g1_alpha_x_current.dat", "setup_db/g1_alpha_x_previous.dat");
    std::rename("./setup_db/g2_x_current.dat", "setup_db/g2_x_previous.dat");
    std::rename("./setup_db/g2_alpha_x_current.dat", "setup_db/g2_alpha_x_previous.dat");

    // write g1_x to file
    streaming::write_g1_elements_to_buffer<Fq, G1>(&g1_x[0], read_write_buffer, POLYNOMIAL_DEGREE); // "g1_x.dat");
    streaming::add_checksum_to_buffer(read_write_buffer, G1_BUFFER_SIZE);
    streaming::write_buffer_to_file("./setup_db/g1_x_current.dat", read_write_buffer, G1_BUFFER_SIZE);

    // write g1_alpha_x to file
    streaming::write_g1_elements_to_buffer<Fq, G1>(&g1_alpha_x[0], read_write_buffer, POLYNOMIAL_DEGREE); // "g1_alpha_x.dat");
    streaming::add_checksum_to_buffer(read_write_buffer, G1_BUFFER_SIZE);
    streaming::write_buffer_to_file("./setup_db/g1_alpha_x_current.dat", read_write_buffer, G1_BUFFER_SIZE);

    // write g2_x to file
    streaming::write_g2_elements_to_buffer<Fqe, G2>(&g2_x[0], read_write_buffer, POLYNOMIAL_DEGREE); // "g2_x.dat");
    streaming::add_checksum_to_buffer(read_write_buffer, G2_BUFFER_SIZE);
    streaming::write_buffer_to_file("./setup_db/g2_x_current.dat", read_write_buffer, G2_BUFFER_SIZE);

    // write g2_alpha_x to file
    streaming::write_g2_elements_to_buffer<Fqe, G2>(&g2_alpha_x[0], read_write_buffer, POLYNOMIAL_DEGREE); // "g2_alpha_x.dat");
    streaming::add_checksum_to_buffer(read_write_buffer, G2_BUFFER_SIZE);
    streaming::write_buffer_to_file("./setup_db/g2_alpha_x_current.dat", read_write_buffer, G2_BUFFER_SIZE);

    // wipe out accumulator. Use explicit_bzero so that this does not get optimized away
    explicit_bzero((void*)&accumulator, sizeof(Fr));
    // and wipe out our multiplicand
    explicit_bzero((void*)&multiplicand, sizeof(Fr));
    // and alpha
    explicit_bzero((void*)&alpha, sizeof(Fr));

    // free the memory we allocated to our write buffer
    free(read_write_buffer);
    // free our point arrays
    free(g1_x);
    free(g1_alpha_x);
    free(g2_x);
    free(g2_alpha_x);

    printf("done.\n");
}
} // namespace setup
