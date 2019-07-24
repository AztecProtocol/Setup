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
#include <atomic>
#include <chrono>

#include <libff/common/profiling.hpp>
#include <libff/common/utils.hpp>
#include <libff/algebra/curves/public_params.hpp>
#include <libff/algebra/curves/curve_utils.hpp>
#include <libff/algebra/scalar_multiplication/wnaf.hpp>

#include <aztec_common/assert.hpp>
#include <aztec_common/checksum.hpp>
#include <aztec_common/streaming.hpp>

#include "utils.hpp"

constexpr unsigned int G1_WEIGHT = 2;
constexpr unsigned int G2_WEIGHT = 9;
constexpr unsigned int TOTAL_WEIGHT = G1_WEIGHT + G2_WEIGHT;

namespace setup
{

template <typename FieldT, typename GroupT, size_t N>
void compute_aztec_polynomial_section(FieldT &y, std::vector<GroupT> &g_x, size_t start, size_t interval, std::atomic<unsigned int> &progress)
{
    constexpr size_t WNAF_WINDOW_SIZE = 5;

    FieldT accumulator = y ^ (unsigned long)(start + 1);

    for (size_t i = start; i < start + interval; ++i)
    {
        libff::bigint<N> x_bigint = accumulator.as_bigint();
        g_x[i] = libff::fixed_window_wnaf_exp<GroupT, N>(WNAF_WINDOW_SIZE, g_x[i], x_bigint);
        accumulator = accumulator * y;
        ++progress;
    }
}

template <typename Fr, typename Fq, typename GroupT>
void compute_polynomial(std::vector<GroupT> &g_x, Fr &multiplicand, unsigned int &progress, int weight)
{
    std::atomic<unsigned int> job_progress(0);

    const size_t num_limbs = sizeof(Fq) / GMP_NUMB_BYTES;

    size_t num_threads = std::thread::hardware_concurrency();
    num_threads = num_threads ? num_threads : 4;

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
        threads.push_back(std::thread(compute_aztec_polynomial_section<Fr, GroupT, num_limbs>, std::ref(multiplicand), std::ref(g_x), thread_range_start, range_per_thread, std::ref(job_progress)));
    }

    while (job_progress < g_x.size())
    {
        std::this_thread::sleep_for(std::chrono::seconds(1));
        const unsigned int progress_total = double(progress + (job_progress * weight)) / double(g_x.size() * TOTAL_WEIGHT / 100);
        std::cout << progress_total << std::endl;
    }

    progress = job_progress * weight;

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

    unsigned int progress = 0;

    // our toxic waste... we must ensure this is wiped before this function goes out of scope!
    Fr multiplicand = Fr::random_element();

    std::vector<G1> g1_x(polynomial_degree);
    std::vector<G2> g2_x(polynomial_degree);

    std::cerr << "Will compute " << polynomial_degree << " points." << std::endl;

    if (streaming::is_file_exist("../setup_db/transcript.dat"))
    {
        std::cerr << "Reading transcript..." << std::endl;
        streaming::read_transcript<Fq>(g1_x, g2_x, "../setup_db/transcript.dat");
    }
    else
    {
        std::cerr << "Creating initial transcript..." << std::endl;
        std::fill(g1_x.begin(), g1_x.end(), G1::one());
        std::fill(g2_x.begin(), g2_x.end(), G2::one());
    }

    std::cerr << "Computing g1 multiple-exponentiations..." << std::endl;
    compute_polynomial<Fr, Fq>(g1_x, multiplicand, progress, G1_WEIGHT);

    std::cerr << "Computing g2 multiple-exponentiations..." << std::endl;
    compute_polynomial<Fr, Fq>(g2_x, multiplicand, progress, G2_WEIGHT);

    std::cerr << "Converting points into affine form..." << std::endl;
    utils::batch_normalize<Fq, G1>(0, polynomial_degree, &g1_x[0]);
    utils::batch_normalize<Fqe, G2>(0, polynomial_degree, &g2_x[0]);

    std::cerr << "Writing transcript..." << std::endl;
    streaming::write_transcript<Fq, Fqe>(g1_x, g2_x, "../setup_db/transcript.dat");

    // wipe out multiplicand. Use explicit_bzero so that this does not get optimized away.
    explicit_bzero((void *)&multiplicand, sizeof(Fr));

    std::cerr << "Done." << std::endl;
}
} // namespace setup
