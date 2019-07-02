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
#include <thread>

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

template <typename FieldT, typename GroupT, size_t N>
void compute_aztec_polynomial_section(FieldT y, GroupT *g1_x, size_t start, size_t interval)
{
    FieldT accumulator = y ^ (unsigned long)(start + 1);
    FieldT multiplicand = accumulator;

    for (size_t i = start; i < start + interval; ++i)
    {
        if (i % 100000 == 0)
        {
            printf("i = %d\n", (int)i);
        }
        libff::bigint<N> x_bigint = accumulator.as_bigint();
        g1_x[i] = libff::fixed_window_wnaf_exp<GroupT, N>(WNAF_WINDOW_SIZE, g1_x[i], x_bigint);
        accumulator = accumulator * multiplicand;
    }
}

template <typename ppT>
void run_setup(uint polynomial_degree_aztec)
{
    using Fr = libff::Fr<ppT>;
    using Fq = libff::Fq<ppT>;
    using Fqe = libff::Fqe<ppT>;
    using G1 = libff::G1<ppT>;
    using G2 = libff::G2<ppT>;

    const size_t num_limbs = sizeof(Fq) / GMP_NUMB_BYTES;
    const size_t G1_BUFFER_SIZE_AZTEC = sizeof(Fq) * 2 * polynomial_degree_aztec;
    const size_t G1_BUFFER_SIZE_SONIC = sizeof(Fq) * 2 * POLYNOMIAL_DEGREE_SONIC;
    const size_t G2_BUFFER_SIZE_SONIC = sizeof(Fq) * 4 * POLYNOMIAL_DEGREE_SONIC;

    printf("inside run setup\n");

    // our toxic waste... we must ensure this is wiped before this function goes out of scope!
    Fr accumulator = Fr::random_element();
    Fr multiplicand = accumulator;

    printf("allocating memory\n");

    // set up our point arrays
    G1 *g1_x = (G1 *)malloc(polynomial_degree_aztec * sizeof(G1));
    G2 *g2_x = (G2 *)malloc(POLYNOMIAL_DEGREE_SONIC * sizeof(G2));
    // set up our read write buffer
    char *read_write_buffer = (char *)malloc(G1_BUFFER_SIZE_AZTEC + checksum::BLAKE2B_CHECKSUM_LENGTH);

    if (is_file_exist("../setup_db/g1_x_current.dat"))
    {
        printf("previous setup transcript found, reading from disk...\n");
        streaming::read_file_into_buffer("../setup_db/g1_x_current.dat", read_write_buffer, G1_BUFFER_SIZE_AZTEC);
        streaming::read_g1_elements_from_buffer<Fq, G1>(&g1_x[0], read_write_buffer, G1_BUFFER_SIZE_AZTEC);
        streaming::validate_checksum(read_write_buffer, G1_BUFFER_SIZE_AZTEC);

        streaming::read_file_into_buffer("../setup_db/g2_x_current.dat", read_write_buffer, G1_BUFFER_SIZE_SONIC);
        streaming::read_g2_elements_from_buffer<Fq, G2>(&g2_x[0], read_write_buffer, G1_BUFFER_SIZE_SONIC);
        streaming::validate_checksum(read_write_buffer, G1_BUFFER_SIZE_SONIC);

#if VERIFY_TRANSCRIPT > 0
        printf("verifying previous transcript...\n");
        bool result = verifier::validate_transcript<ppT>(&g1_x[0], &g2_x[0], POLYNOMIAL_DEGREE_SONIC, polynomial_degree_aztec);
        printf("transcript result = %d\n", (int)result);
        ASSERT(result == true);
#endif
    }
    else
    {
        printf("could not find previous setup transcript, creating initial transcript...\n");
        for (size_t i = 0; i < POLYNOMIAL_DEGREE_SONIC; ++i)
        {
            if (i % 100000 == 0)
            {
                printf("i = %d\n", (int)i);
            }
            g1_x[i] = G1::one();
            g2_x[i] = G2::one();
        }
        for (size_t i = POLYNOMIAL_DEGREE_SONIC; i < polynomial_degree_aztec; ++i)
        {
            if (i % 100000 == 0)
            {
                printf("i = %d\n", (int)i);
            }
            g1_x[i] = G1::one();
        }
    }

    printf("initialized setup polynomials, updating setup transcript...\n");

    size_t num_threads = (size_t)std::thread::hardware_concurrency();
    if (num_threads == 0)
    {
        // um, make a guess?
        printf("INFO: could not profile target CPU, defaulting to 4 threads\n");
        num_threads = 4;
    }

    printf("computing g1 multiple-exponentiations\n");
    size_t range_per_thread = polynomial_degree_aztec / num_threads;
    size_t leftovers = polynomial_degree_aztec - (range_per_thread * num_threads);
    std::vector<std::thread> threads;
    for (uint i = 0; i < num_threads; i++)
    {
        size_t thread_range_start = (i * range_per_thread);
        if (i == num_threads - 1)
        {
            range_per_thread += leftovers;
        }
        threads.push_back(std::thread(compute_aztec_polynomial_section<Fr, G1, num_limbs>, multiplicand, g1_x, thread_range_start, range_per_thread));
    }
    for (uint i = 0; i < num_threads; i++)
    {
        threads[i].join();
    }

    printf("computing g2 multiple-exponentiations\n");
    range_per_thread = POLYNOMIAL_DEGREE_SONIC / num_threads;
    leftovers = POLYNOMIAL_DEGREE_SONIC - (range_per_thread * num_threads);
    threads.clear();
    for (uint i = 0; i < num_threads; i++)
    {
        size_t thread_range_start = (i * range_per_thread);
        if (i == num_threads - 1)
        {
            range_per_thread += leftovers;
        }
        threads.push_back(std::thread(compute_aztec_polynomial_section<Fr, G2, num_limbs>, multiplicand, g2_x, thread_range_start, range_per_thread));
    }
    for (uint i = 0; i < num_threads; i++)
    {
        threads[i].join();
    }

    printf("updated setup transcript, converting points into affine form...\n");
    utils::batch_normalize<Fq, G1>(0, polynomial_degree_aztec, &g1_x[0]);
    utils::batch_normalize<Fqe, G2>(0, POLYNOMIAL_DEGREE_SONIC, &g2_x[0]);

    printf("writing setup transcript to disk...\n");
    std::rename("../setup_db/g1_x_current.dat", "../setup_db/g1_x_previous.dat");
    std::rename("../setup_db/g2_x_current.dat", "../setup_db/g2_x_previous.dat");

    // write g1_x to file
    streaming::write_g1_elements_to_buffer<Fq, G1>(&g1_x[0], read_write_buffer, polynomial_degree_aztec); // "g1_x.dat");
    streaming::add_checksum_to_buffer(read_write_buffer, G1_BUFFER_SIZE_AZTEC);
    streaming::write_buffer_to_file("../setup_db/g1_x_current.dat", read_write_buffer, G1_BUFFER_SIZE_AZTEC);

    // write g2_x to file
    streaming::write_g2_elements_to_buffer<Fqe, G2>(&g2_x[0], read_write_buffer, POLYNOMIAL_DEGREE_SONIC); // "g2_x.dat");
    streaming::add_checksum_to_buffer(read_write_buffer, G2_BUFFER_SIZE_SONIC);
    streaming::write_buffer_to_file("../setup_db/g2_x_current.dat", read_write_buffer, G2_BUFFER_SIZE_SONIC);

    // wipe out accumulator. Use explicit_bzero so that this does not get optimized away
    explicit_bzero((void *)&accumulator, sizeof(Fr));
    // and wipe out our multiplicand
    explicit_bzero((void *)&multiplicand, sizeof(Fr));
    // and alpha
    // explicit_bzero((void*)&alpha, sizeof(Fr));

    // free the memory we allocated to our write buffer
    free(read_write_buffer);
    // free our point arrays
    free(g1_x);
    // free(g1_alpha_x);
    free(g2_x);
    // free(g2_alpha_x);

    printf("done.\n");
}
} // namespace setup
