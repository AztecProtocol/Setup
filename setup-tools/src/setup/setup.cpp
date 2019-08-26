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

#include <aztec_common/streaming_transcript.hpp>

#include "utils.hpp"

constexpr size_t G1_WEIGHT = 2;
constexpr size_t G2_WEIGHT = 9;
constexpr size_t TOTAL_WEIGHT = G1_WEIGHT + G2_WEIGHT;
constexpr size_t WNAF_WINDOW_SIZE = 5;

auto getTranscriptInPath(std::string const &dir, size_t num)
{
    return dir + "/transcript" + std::to_string(num) + ".dat";
};

auto getTranscriptOutPath(std::string const &dir, size_t num)
{
    return dir + "/transcript" + std::to_string(num) + "_out.dat";
};

// A compute thread. A job consists of multiple threads.
template <typename GroupT, size_t N>
void compute_thread(Fr const &y, std::vector<GroupT> &g_x, size_t transcript_start, size_t thread_start, size_t thread_range, std::atomic<size_t> &progress)
{
    Fr accumulator = y ^ (unsigned long)(transcript_start + thread_start + 1);

    for (size_t i = thread_start; i < thread_start + thread_range; ++i)
    {
        libff::bigint<N> x_bigint = accumulator.as_bigint();
        g_x[i] = libff::fixed_window_wnaf_exp<GroupT, N>(WNAF_WINDOW_SIZE, g_x[i], x_bigint);
        accumulator = accumulator * y;
        ++progress;
    }
}

// A compute job. Processing a single transcript file results in a two jobs computed in serial over G1 and G2.
template <typename GroupT>
void compute_job(std::vector<GroupT> &g_x, size_t start_from, size_t progress_total, Fr const &multiplicand, size_t &progress, int weight)
{
    std::atomic<size_t> job_progress(0);

    const size_t num_limbs = sizeof(Fq) / GMP_NUMB_BYTES;

    size_t num_threads = std::thread::hardware_concurrency();
    num_threads = num_threads ? num_threads : 4;

    size_t thread_range = g_x.size() / num_threads;
    size_t leftovers = g_x.size() - (thread_range * num_threads);
    std::vector<std::thread> threads;

    for (uint i = 0; i < num_threads; i++)
    {
        size_t thread_start = (i * thread_range);
        if (i == num_threads - 1)
        {
            thread_range += leftovers;
        }
        threads.push_back(std::thread(compute_thread<GroupT, num_limbs>, std::ref(multiplicand), std::ref(g_x), start_from, thread_start, thread_range, std::ref(job_progress)));
    }

    while (job_progress < g_x.size())
    {
        std::this_thread::sleep_for(std::chrono::seconds(1));
        const double progress_percent = double(progress + (job_progress * weight)) / double(progress_total / 100);
        // Signals calling process the progress.
        std::cout << "progress " << progress_percent << std::endl;
    }

    progress += job_progress * weight;

    for (uint i = 0; i < threads.size(); i++)
    {
        threads[i].join();
    }
}

// Runs two jobs over G1 and G2 data and writes results to a given transcript file.
void compute_transcript(std::string const &dir, std::vector<G1> &g1_x, std::vector<G2> &g2_x, streaming::Manifest &manifest, Fr const &multiplicand, size_t &progress)
{
    size_t const progress_total = manifest.total_g1_points * G1_WEIGHT + manifest.total_g2_points * G2_WEIGHT;

    std::cerr << "Computing g1 multiple-exponentiations..." << std::endl;
    compute_job(g1_x, manifest.start_from, progress_total, multiplicand, progress, G1_WEIGHT);

    std::cerr << "Computing g2 multiple-exponentiations..." << std::endl;
    compute_job(g2_x, manifest.start_from, progress_total, multiplicand, progress, G2_WEIGHT);

    if (manifest.transcript_number == 0)
    {
        // We need g2^y for verifying this participants transcript was built on top of the last.
        // Remember to pop this off the end when reading...
        manifest.num_g2_points += 1;
        G2 g2_y = libff::fixed_window_wnaf_exp<G2, sizeof(Fq) / GMP_NUMB_BYTES>(WNAF_WINDOW_SIZE, G2::one(), multiplicand.as_bigint());
        g2_x.push_back(g2_y);
    }

    std::cerr << "Converting points into affine form..." << std::endl;
    utils::batch_normalize<Fq, G1>(0, g1_x.size(), &g1_x[0]);
    utils::batch_normalize<Fqe, G2>(0, g2_x.size(), &g2_x[0]);

    std::cerr << "Writing transcript..." << std::endl;
    std::string const filename = getTranscriptOutPath(dir, manifest.transcript_number);
    streaming::write_transcript(g1_x, g2_x, manifest, filename);

    // Signals calling process this transcript file is complete.
    std::cout << "wrote " << manifest.transcript_number << std::endl;
}

size_t calculate_current_progress(streaming::Manifest const &manifest, size_t transcript_index)
{
    size_t g1_points = std::min((size_t)manifest.total_g1_points, (size_t)manifest.start_from);
    size_t g2_points = std::min((size_t)manifest.total_g2_points, (size_t)manifest.start_from);
    return g1_points * G1_WEIGHT + g2_points * G2_WEIGHT;
}

// Given an existing transcript file, read it and start computation.
void compute_existing_transcript(std::string const &dir, size_t num, Fr &multiplicand, size_t &progress)
{
    streaming::Manifest manifest;
    std::vector<G1> g1_x;
    std::vector<G2> g2_x;

    std::cerr << "Reading transcript..." << std::endl;
    std::string const filename = getTranscriptInPath(dir, num);
    streaming::read_transcript(g1_x, g2_x, manifest, filename);

    if (num == 0)
    {
        // Discard the additional g2^y point in transcript 0. This is only used for verification.
        g2_x.pop_back();
        manifest.num_g2_points -= 1;
    }

    progress = calculate_current_progress(manifest, num);

    std::cerr << "Will compute " << manifest.num_g1_points << " G1 points and " << manifest.num_g2_points << " G2 points on top of transcript " << manifest.transcript_number << std::endl;

    compute_transcript(dir, g1_x, g2_x, manifest, multiplicand, progress);
}

// Computes initial transcripts.
void compute_initial_transcripts(const std::string &dir, size_t total_g1_points, size_t total_g2_points, size_t points_per_transcript, Fr &multiplicand, size_t &progress)
{
    const size_t max_points = std::max(total_g1_points, total_g2_points);
    const size_t total_transcripts = max_points / points_per_transcript + (max_points % points_per_transcript ? 1 : 0);

    std::cerr << "Creating initial transcripts..." << std::endl;

    std::vector<streaming::Manifest> manifests;
    manifests.resize(total_transcripts);

    // Define transcripts.
    for (size_t i = 0; i < total_transcripts; ++i)
    {
        size_t start_from = i * points_per_transcript;
        size_t num_g1_points = std::min(points_per_transcript, total_g1_points >= start_from ? (size_t)total_g1_points - start_from : 0);
        size_t num_g2_points = std::min(points_per_transcript, total_g2_points >= start_from ? (size_t)total_g2_points - start_from : 0);

        streaming::Manifest &manifest = manifests[i];
        manifest.transcript_number = i;
        manifest.total_transcripts = total_transcripts;
        manifest.total_g1_points = total_g1_points;
        manifest.total_g2_points = total_g2_points;
        manifest.start_from = start_from;
        manifest.num_g1_points = num_g1_points;
        manifest.num_g2_points = num_g2_points;
    }

    // Signal their sizes to calling process.
    std::cout << "creating";
    for (size_t i = 0; i < total_transcripts; ++i)
    {
        std::cout << " " << i << ":" << streaming::get_transcript_size(manifests[i]);
    }
    std::cout << std::endl;

    for (auto it = manifests.begin(); it != manifests.end(); ++it)
    {
        std::vector<G1> g1_x(it->num_g1_points, G1::one());
        std::vector<G2> g2_x(it->num_g2_points, G2::one());

        std::cerr << "Will compute " << it->num_g1_points << " G1 points and " << it->num_g2_points << " G2 points starting from " << it->start_from << " in transcript " << it->transcript_number << std::endl;

        compute_transcript(dir, g1_x, g2_x, *it, multiplicand, progress);
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

void run_setup(std::string const &dir, size_t num_g1_points, size_t num_g2_points)
{
    size_t progress = 0;

#ifdef SIMULATE_PARTICIPANT
    std::vector<char> checksums;
    std::cerr << "Running setup with simulated participant." << std::endl;
    size_t num = 0;
    std::string filename = getTranscriptInPath(dir, num);
    while (streaming::is_file_exist(filename))
    {
        std::vector<char> checksum = streaming::read_checksum(filename);
        checksums.insert(checksums.end(), checksum.begin(), checksum.end());
        ++num;
        filename = getTranscriptInPath(dir, num);
    }
    char checksum_of_checksums[checksum::BLAKE2B_CHECKSUM_LENGTH] = {0};
    checksum::create_checksum(&checksums[0], checksums.size(), &checksum_of_checksums[0]);
    Fr simulated_secret = utils::convert_buffer_to_field_element<Fr>(&checksum_of_checksums[0], checksum::BLAKE2B_CHECKSUM_LENGTH);
    Secret<Fr> multiplicand(simulated_secret);
#else
    // Our toxic waste. Will be zeroed before going out of scope.
    Secret<Fr> multiplicand(Fr::random_element());
#endif

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
                size_t num_g1_points, num_g2_points, points_per_transcript;
                iss >> num_g1_points >> num_g2_points >> points_per_transcript;
                compute_initial_transcripts(dir, num_g1_points, num_g2_points, points_per_transcript, multiplicand, progress);
            }
            else if (cmd == "process")
            {
                size_t num;
                iss >> num;
                compute_existing_transcript(dir, num, multiplicand, progress);
            }
        }
    }
    else
    {
        // Being manually run.
        if (num_g1_points > 0)
        {
            compute_initial_transcripts(dir, num_g1_points, num_g2_points, POINTS_PER_TRANSCRIPT, multiplicand, progress);
        }
        else
        {
            size_t num = 0;
            std::string filename = getTranscriptInPath(dir, num);
            while (streaming::is_file_exist(filename))
            {
                compute_existing_transcript(dir, num, multiplicand, progress);
                filename = getTranscriptInPath(dir, ++num);
            }

            if (num == 0)
            {
                std::cerr << "No input files found." << std::endl;
            }
        }

        std::cerr << "Done." << std::endl;
    }
}