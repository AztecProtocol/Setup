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

constexpr size_t POINTS_PER_TRANSCRIPT = 100000;
constexpr size_t G1_WEIGHT = 2;
constexpr size_t G2_WEIGHT = 9;
constexpr size_t TOTAL_WEIGHT = G1_WEIGHT + G2_WEIGHT;

namespace setup
{

// A compute thread. A job consists of multiple threads.
template <typename FieldT, typename GroupT, size_t N>
void compute_thread(FieldT &y, std::vector<GroupT> &g_x, size_t start_from, size_t start, size_t interval, std::atomic<size_t> &progress)
{
    constexpr size_t WNAF_WINDOW_SIZE = 5;

    FieldT accumulator = y ^ (unsigned long)(start_from + start + 1);

    for (size_t i = start; i < start + interval; ++i)
    {
        libff::bigint<N> x_bigint = accumulator.as_bigint();
        g_x[i] = libff::fixed_window_wnaf_exp<GroupT, N>(WNAF_WINDOW_SIZE, g_x[i], x_bigint);
        accumulator = accumulator * y;
        ++progress;
    }
}

// A compute job. Processing a single transcript file results in a two jobs computed in serial over G1 and G2.
template <typename Fr, typename Fq, typename GroupT>
void compute_job(std::vector<GroupT> &g_x, size_t start_from, size_t polynomial_degree, Fr &multiplicand, size_t &progress, int weight)
{
    std::atomic<size_t> job_progress(0);

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
        threads.push_back(std::thread(compute_thread<Fr, GroupT, num_limbs>, std::ref(multiplicand), std::ref(g_x), start_from, thread_range_start, range_per_thread, std::ref(job_progress)));
    }

    while (job_progress < g_x.size())
    {
        std::this_thread::sleep_for(std::chrono::seconds(1));
        const double progress_total = double(progress + (job_progress * weight)) / double(polynomial_degree * TOTAL_WEIGHT / 100);
        // Signals calling process the progress.
        std::cout << progress_total << std::endl;
    }

    progress += job_progress * weight;

    for (uint i = 0; i < threads.size(); i++)
    {
        threads[i].join();
    }
}

// Runs two jobs over G1 and G2 data and writes results to a given transcript file.
template <typename Fr, typename Fqe, typename Fq, typename G1, typename G2>
void compute_transcript(std::string const &filename, std::vector<G1> &g1_x, std::vector<G2> &g2_x, size_t start_from, size_t polynomial_degree, Fr &multiplicand, size_t &progress)
{
    std::cerr << "Computing g1 multiple-exponentiations..." << std::endl;
    compute_job<Fr, Fq>(g1_x, start_from, polynomial_degree, multiplicand, progress, G1_WEIGHT);

    std::cerr << "Computing g2 multiple-exponentiations..." << std::endl;
    compute_job<Fr, Fq>(g2_x, start_from, polynomial_degree, multiplicand, progress, G2_WEIGHT);

    std::cerr << "Converting points into affine form..." << std::endl;
    utils::batch_normalize<Fq, G1>(0, g1_x.size(), &g1_x[0]);
    utils::batch_normalize<Fqe, G2>(0, g2_x.size(), &g2_x[0]);

    std::cerr << "Writing transcript..." << std::endl;
    streaming::write_transcript<Fq, Fqe>(g1_x, g2_x, start_from, filename);

    // Signals calling process this transcript file is complete.
    std::cout << filename << std::endl;
}

// Given an existing transcript file, read it and start computation.
template <typename Fr, typename Fqe, typename Fq, typename G1, typename G2>
void compute_existing_transcript(std::string const &filename, size_t polynomial_degree, Fr &multiplicand, size_t &progress)
{
    size_t start_from;
    std::vector<G1> g1_x;
    std::vector<G2> g2_x;

    if (!streaming::is_file_exist(filename))
    {
        throw std::runtime_error("File not found: " + filename);
    }

    std::cerr << "Reading transcript..." << std::endl;
    streaming::read_transcript<Fq, G1, G2>(g1_x, g2_x, start_from, filename);

    std::cerr << "Will compute " << g1_x.size() << " points on top of " << filename << std::endl;

    compute_transcript<Fr, Fqe, Fq, G1, G2>(filename, g1_x, g2_x, start_from, polynomial_degree, multiplicand, progress);
}

// Computes initial transcripts.
template <typename Fr, typename Fqe, typename Fq, typename G1, typename G2>
void compute_initial_transcripts(size_t polynomial_degree, Fr &multiplicand, size_t &progress)
{
    std::cerr << "Creating initial transcripts..." << std::endl;

    for (size_t i = 0, start_from = 0; start_from < polynomial_degree; start_from += POINTS_PER_TRANSCRIPT, ++i)
    {
        std::string filename("../setup_db/transcript" + std::to_string(i) + ".dat");
        size_t num = std::min(POINTS_PER_TRANSCRIPT, polynomial_degree - start_from);
        std::vector<G1> g1_x(num, G1::one());
        std::vector<G2> g2_x(num, G2::one());

        std::cerr << "Will compute " << num << " points starting from " << start_from << " in " << filename << std::endl;

        compute_transcript<Fr, Fqe, Fq, G1, G2>(filename, g1_x, g2_x, start_from, polynomial_degree, multiplicand, progress);
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

    size_t progress = 0;

    // our toxic waste... we must ensure this is wiped before this function goes out of scope!
    Fr multiplicand = Fr::random_element();

    for (std::string filename; std::getline(std::cin, filename);)
    {
        compute_existing_transcript<Fr, Fqe, Fq, G1, G2>(filename, polynomial_degree, multiplicand, progress);
    }

    if (progress == 0)
    {
        // Input stream was immediately closed. We are performing the initial computation.
        compute_initial_transcripts<Fr, Fqe, Fq, G1, G2>(polynomial_degree, multiplicand, progress);
    }

    // wipe out multiplicand. Use explicit_bzero so that this does not get optimized away.
    explicit_bzero((void *)&multiplicand, sizeof(Fr));

    std::cerr << "Done." << std::endl;
}
} // namespace setup
