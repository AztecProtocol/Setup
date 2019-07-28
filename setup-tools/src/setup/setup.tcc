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
#include <unistd.h>

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

auto getTranscriptInPath(std::string const &dir, size_t num)
{
    return dir + "/transcript" + std::to_string(num) + ".dat";
};

auto getTranscriptOutPath(std::string const &dir, size_t num)
{
    return dir + "/transcript" + std::to_string(num) + "_out.dat";
};

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
        std::cout << "progress " << progress_total << std::endl;
    }

    progress += job_progress * weight;

    for (uint i = 0; i < threads.size(); i++)
    {
        threads[i].join();
    }
}

// Runs two jobs over G1 and G2 data and writes results to a given transcript file.
template <typename Fr, typename Fqe, typename Fq, typename G1, typename G2>
void compute_transcript(std::string const &dir, std::vector<G1> &g1_x, std::vector<G2> &g2_x, streaming::Manifest const &manifest, Fr &multiplicand, size_t &progress)
{
    std::cerr << "Computing g1 multiple-exponentiations..." << std::endl;
    compute_job<Fr, Fq>(g1_x, manifest.start_from, manifest.total_points, multiplicand, progress, G1_WEIGHT);

    std::cerr << "Computing g2 multiple-exponentiations..." << std::endl;
    compute_job<Fr, Fq>(g2_x, manifest.start_from, manifest.total_points, multiplicand, progress, G2_WEIGHT);

    std::cerr << "Converting points into affine form..." << std::endl;
    utils::batch_normalize<Fq, G1>(0, g1_x.size(), &g1_x[0]);
    utils::batch_normalize<Fqe, G2>(0, g2_x.size(), &g2_x[0]);

    std::cerr << "Writing transcript..." << std::endl;
    std::string const filename = getTranscriptOutPath(dir, manifest.transcript_number);
    streaming::write_transcript<Fq, Fqe>(g1_x, g2_x, manifest, filename);

    // Signals calling process this transcript file is complete.
    std::cout << "wrote " << manifest.transcript_number << std::endl;
}

// Given an existing transcript file, read it and start computation.
template <typename Fr, typename Fqe, typename Fq, typename G1, typename G2>
void compute_existing_transcript(std::string const &dir, size_t num, Fr &multiplicand, size_t &progress)
{
    streaming::Manifest manifest;
    std::vector<G1> g1_x;
    std::vector<G2> g2_x;

    std::cerr << "Reading transcript..." << std::endl;
    std::string const filename = getTranscriptInPath(dir, num);
    streaming::read_transcript<Fq, G1, G2>(g1_x, g2_x, manifest, filename);

    std::cerr << "Will compute " << manifest.num_points << " points on top of transcript " << manifest.transcript_number << std::endl;

    compute_transcript<Fr, Fqe, Fq, G1, G2>(dir, g1_x, g2_x, manifest, multiplicand, progress);
}

// Computes initial transcripts.
template <typename Fr, typename Fqe, typename Fq, typename G1, typename G2>
void compute_initial_transcripts(const std::string &dir, size_t polynomial_degree, size_t start_from, Fr &multiplicand, size_t &progress)
{
    std::cerr << "Creating initial transcripts..." << std::endl;

    progress = start_from * POINTS_PER_TRANSCRIPT * TOTAL_WEIGHT;

    std::vector<streaming::Manifest> manifests;
    const size_t total_transcripts = polynomial_degree / POINTS_PER_TRANSCRIPT + (polynomial_degree % POINTS_PER_TRANSCRIPT ? 1 : 0);
    manifests.resize(total_transcripts);

    // Define transcripts and signal their sizes to calling process.
    std::cout << "creating";
    for (size_t i = start_from; i < total_transcripts; ++i)
    {
        streaming::Manifest &manifest = manifests[i];
        manifest.transcript_number = i;
        manifest.total_transcripts = total_transcripts;
        manifest.total_points = polynomial_degree;
        manifest.start_from = i * POINTS_PER_TRANSCRIPT;
        manifest.num_points = std::min(POINTS_PER_TRANSCRIPT, (size_t)manifest.total_points - manifest.start_from);

        std::cout << " " << i << ":" << streaming::get_transcript_size<Fq, G1, G2>(manifest.num_points);
    }
    std::cout << std::endl;

    for (auto it = manifests.begin() + start_from; it != manifests.end(); ++it)
    {
        std::vector<G1> g1_x(it->num_points, G1::one());
        std::vector<G2> g2_x(it->num_points, G2::one());

        std::cerr << "Will compute " << it->num_points << " points starting from " << it->start_from << " in transcript " << it->transcript_number << std::endl;

        compute_transcript<Fr, Fqe, Fq, G1, G2>(dir, g1_x, g2_x, *it, multiplicand, progress);
    }
}

template <typename T>
class Secret
{
public:
    Secret(T const &t)
        : t_(t)
    {
    }

    ~Secret()
    {
        explicit_bzero((void *)&t_, sizeof(T));
    }

    operator T &()
    {
        return t_;
    }

private:
    Secret(const Secret &);
    Secret &operator=(const Secret &);
    T t_;
};

template <typename ppT>
void run_setup(std::string const &dir, size_t polynomial_degree)
{
    using Fr = libff::Fr<ppT>;
    using Fq = libff::Fq<ppT>;
    using Fqe = libff::Fqe<ppT>;
    using G1 = libff::G1<ppT>;
    using G2 = libff::G2<ppT>;

    size_t progress = 0;

    // Our toxic waste. Will be zeroed before going out of scope.
    Secret<Fr> multiplicand(Fr::random_element());

    if (!isatty(fileno(stdin)))
    {
        std::cerr << "Awaiting commands from stdin..." << std::endl;

        // Being controlled via commands over stdin.
        for (std::string cmd_line; std::getline(std::cin, cmd_line);)
        {
            std::istringstream iss(cmd_line);
            std::string cmd;

            iss >> cmd;
            if (cmd == "create")
            {
                size_t polynomial_degree;
                size_t start_from;
                iss >> polynomial_degree >> start_from;
                compute_initial_transcripts<Fr, Fqe, Fq, G1, G2>(dir, polynomial_degree, start_from, multiplicand, progress);
            }
            else if (cmd == "process")
            {
                size_t num;
                iss >> num;
                progress = num * POINTS_PER_TRANSCRIPT * TOTAL_WEIGHT;
                compute_existing_transcript<Fr, Fqe, Fq, G1, G2>(dir, num, multiplicand, progress);
            }
        }
    }
    else
    {
        // Being manually run.
        if (polynomial_degree > 0)
        {
            size_t start_from = 0;
            std::string filename = getTranscriptOutPath(dir, start_from);
            while (streaming::is_file_exist(filename)) {
                filename = getTranscriptOutPath(dir, ++start_from);
            }
            compute_initial_transcripts<Fr, Fqe, Fq, G1, G2>(dir, polynomial_degree, start_from, multiplicand, progress);
        }
        else
        {
            size_t num = 0;
            std::string filename = getTranscriptInPath(dir, num);
            while (streaming::is_file_exist(filename))
            {
                if (!streaming::is_file_exist(getTranscriptOutPath(dir, num))) {
                    progress = num * POINTS_PER_TRANSCRIPT * TOTAL_WEIGHT;
                    compute_existing_transcript<Fr, Fqe, Fq, G1, G2>(dir, num, multiplicand, progress);
                }
                filename = getTranscriptInPath(dir, ++num);
            }
        }

        std::cerr << "Done." << std::endl;
    }
}