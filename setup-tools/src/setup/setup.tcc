/**
 * Setup
 * Copyright Spilsbury Holdings 2019
 **/
#include <string.h>
#include <stdlib.h>
#include <iostream>
#include <stdio.h>
#include <string.h>
#include <thread>

#include <libff/common/profiling.hpp>
#include <libff/common/utils.hpp>
#include <libff/algebra/curves/public_params.hpp>
#include <libff/algebra/curves/curve_utils.hpp>
#include <libff/algebra/scalar_multiplication/wnaf.hpp>

#include <aztec_common/assert.hpp>
#include <aztec_common/checksum.hpp>
#include <aztec_common/streaming.hpp>

#include "utils.hpp"

namespace setup
{

template <typename FieldT, typename GroupT, size_t N>
void compute_aztec_polynomial_section(FieldT *y, GroupT *g_x, size_t start, size_t interval)
{
    constexpr size_t WNAF_WINDOW_SIZE = 5;

    FieldT accumulator = *y ^ (unsigned long)(start + 1);

    for (size_t i = start; i < start + interval; ++i)
    {
        if (i % 100000 == 0)
        {
            printf("i = %d\n", (int)i);
        }
        libff::bigint<N> x_bigint = accumulator.as_bigint();
        g_x[i] = libff::fixed_window_wnaf_exp<GroupT, N>(WNAF_WINDOW_SIZE, g_x[i], x_bigint);
        accumulator = accumulator * *y;
    }
}

template <typename Fr, typename Fq, typename GroupT>
void compute_polynomial(std::vector<GroupT> &g_x, Fr &multiplicand)
{
    const size_t num_limbs = sizeof(Fq) / GMP_NUMB_BYTES;

    size_t num_threads = (size_t)std::thread::hardware_concurrency();
    if (num_threads == 0)
    {
        // um, make a guess?
        printf("INFO: could not profile target CPU, defaulting to 4 threads\n");
        num_threads = 4;
    }

    size_t range_per_thread = g_x.size() / num_threads;
    size_t leftovers = g_x.size() - (range_per_thread * num_threads);
    std::vector<std::thread> threads;

    for (uint i = 0; i < num_threads; i++)
    {
        size_t thread_range_start = (i * range_per_thread);
        if (i == num_threads - 1)
        {
            range_per_thread += leftovers;
        }
        threads.push_back(std::thread(compute_aztec_polynomial_section<Fr, GroupT, num_limbs>, &multiplicand, &g_x[0], thread_range_start, range_per_thread));
    }

    for (uint i = 0; i < threads.size(); i++)
    {
        threads[i].join();
    }
}

template <typename ppT>
void run_setup(size_t polynomial_degree)
{
    using Fr = libff::Fr<ppT>;
    using Fq = libff::Fq<ppT>;
    using Fqe = libff::Fqe<ppT>;
    using G1 = libff::G1<ppT>;
    using G2 = libff::G2<ppT>;

    printf("inside run setup\n");

    // our toxic waste... we must ensure this is wiped before this function goes out of scope!
    Fr multiplicand = Fr::random_element();

    printf("allocating memory\n");

    std::vector<G1> g1_x(polynomial_degree);
    std::vector<G2> g2_x(polynomial_degree);

    if (streaming::is_file_exist("../setup_db/transcript.dat"))
    {
        streaming::read_transcript<Fq>(g1_x, g2_x, "../setup_db/transcript.dat");
    }
    else
    {
        std::cout << "Creating initial transcript..." << std::endl;
        for (size_t i = 0; i < polynomial_degree; ++i)
        {
            if (i % 100000 == 0)
            {
                printf("i = %d\n", (int)i);
            }
            g1_x[i] = G1::one();
            g2_x[i] = G2::one();
        }
        /*
        for (size_t i = polynomial_degree; i < polynomial_degree; ++i)
        {
            if (i % 100000 == 0)
            {
                printf("i = %d\n", (int)i);
            }
            g1_x[i] = G1::one();
        }
        */
    }

    printf("computing g1 multiple-exponentiations\n");
    compute_polynomial<Fr, Fq>(g1_x, multiplicand);

    printf("computing g2 multiple-exponentiations\n");
    compute_polynomial<Fr, Fq>(g2_x, multiplicand);

    printf("updated setup transcript, converting points into affine form...\n");
    utils::batch_normalize<Fq, G1>(0, polynomial_degree, &g1_x[0]);
    utils::batch_normalize<Fqe, G2>(0, polynomial_degree, &g2_x[0]);

    streaming::write_transcript<Fq, Fqe>(g1_x, g2_x, "../setup_db/transcript.dat");

    // wipe out multiplicand. Use explicit_bzero so that this does not get optimized away.
    explicit_bzero((void *)&multiplicand, sizeof(Fr));

    printf("done.\n");
}
} // namespace setup
