/**
 * Setup
 * Copyright Spilsbury Holdings 2019
 **/

#include "verifier.hpp"
#include <thread>
#include <future>

template <typename GroupT>
VerificationKey<GroupT> same_ratio_preprocess_thread(std::vector<GroupT> const &g_x, std::vector<Fq> const &scalars, size_t start_from, size_t num)
{
    VerificationKey<GroupT> key;

    key.lhs = libff::multi_exp<GroupT, Fq, libff::multi_exp_method_bos_coster>(
        g_x.cbegin() + start_from,
        g_x.cbegin() + start_from + num - 1,
        scalars.cbegin() + start_from,
        scalars.cbegin() + start_from + num - 1,
        1);

    key.rhs = libff::multi_exp<GroupT, Fq, libff::multi_exp_method_bos_coster>(
        g_x.cbegin() + start_from + 1,
        g_x.cbegin() + start_from + num,
        scalars.cbegin() + start_from,
        scalars.cbegin() + start_from + num - 1,
        1);

    return key;
}

// We want to validate that a vector of points corresponds to the terms [x, x^2, ..., x^n]
// of an indeterminate x and a random variable z
// Update the verification key so that...
// key.lhs = x.z + x^2.z^2 + ... + x^(n-1).z^(n-1)
// key.rhs = x^2.z + ... + x^n.z^(n-1)
template <typename GroupT>
VerificationKey<GroupT> same_ratio_preprocess(std::vector<GroupT> const &g_x)
{
    Fq challenge = Fq::random_element();

    std::vector<Fq> scalars(g_x.size());
    scalars[0] = challenge;
    for (size_t i = 1; i < scalars.size(); ++i)
    {
        scalars[i] = scalars[i - 1] * challenge;
    }

    size_t num_threads = std::thread::hardware_concurrency();
    num_threads = num_threads ? num_threads : 4;
    size_t thread_range = g_x.size() / num_threads;
    size_t leftovers = g_x.size() - (thread_range * num_threads);
    std::vector<std::thread> threads;
    std::vector<std::future<VerificationKey<GroupT>>> results;

    if (thread_range < 2)
    {
        return same_ratio_preprocess_thread(g_x, scalars, 0, g_x.size());
    }

    for (uint i = 0; i < num_threads; i++)
    {
        size_t start_from = (i * thread_range);
        if (i == num_threads - 1)
        {
            thread_range += leftovers;
        }
        results.push_back(std::async(std::launch::async, same_ratio_preprocess_thread<GroupT>, std::ref(g_x), std::ref(scalars), start_from, thread_range));
    }

    VerificationKey<GroupT> key(results[0].get());
    for (uint i = 1; i < results.size(); i++)
    {
        auto r = results[i].get();
        key.lhs = key.lhs + r.lhs;
        key.rhs = key.rhs + r.rhs;
    }
    return key;
}

// Validate that g1_key.lhs * g2_key.lhs == g1_key.rhs * g2_key.rhs
bool same_ratio(VerificationKey<G1> const &g1_key, VerificationKey<G2> const &g2_key)
{
// turn off profiling printf statements when computing a pairing
#ifndef ENABLE_LIBFF_PROFILING
    libff::inhibit_profiling_info = true;
    libff::inhibit_profiling_counters = true;
#endif // ENABLE_LIBFF_PROFILING

    G1_precomp g1_lhs = ppT::precompute_G1(-g1_key.lhs);
    G1_precomp g1_rhs = ppT::precompute_G1(g1_key.rhs);

    // lhs * delta = rhs * one
    G2_precomp g2_lhs = ppT::precompute_G2(g2_key.lhs);
    G2_precomp g2_rhs = ppT::precompute_G2(g2_key.rhs);

    Fqk miller_result = ppT::double_miller_loop(g1_lhs, g2_lhs, g1_rhs, g2_rhs);
    GT result = ppT::final_exponentiation(miller_result);
    return result == GT::one();
}

// We want to validate that a vector of points corresponds to the terms [x, x^2, ..., x^n] of an indeterminate x
// and a random variable z
// We want to construct two sequences
// 1: A = x.z + x^2.z^2 + ... + x^(n-1).z^(n-1)
// 2: B = x^2.z + ... + x^n.z^(n-1)
// Because every term is multiplied by an independant random variable, we can treat each term as distinct.
// Once we have A and B, we can validate that A*x = B via a pairing check.
// This validates that our original vector represents the powering sequence that we desire
bool validate_polynomial_evaluation(std::vector<G1> const &evaluation, G2 const &comparator)
{
    VerificationKey<G2> delta;

    delta.lhs = comparator;
    delta.rhs = G2::one();

    VerificationKey<G1> key = same_ratio_preprocess(evaluation);

    return same_ratio(key, delta);
}

bool validate_polynomial_evaluation(std::vector<G2> const &evaluation, G1 const &comparator)
{
    VerificationKey<G1> delta;

    delta.lhs = comparator;
    delta.rhs = G1::one();

    VerificationKey<G2> key = same_ratio_preprocess(evaluation);

    return same_ratio(delta, key);
}

bool validate_transcript_derived_from_previous(G1 const &g1_0_previous, G1 const &g1_0_current, G2 const &g2_y)
{
    VerificationKey<G1> key1;
    VerificationKey<G2> key2;

    key1.lhs = g1_0_previous;
    key1.rhs = g1_0_current;

    key2.lhs = g2_y;
    key2.rhs = G2::one();

    return same_ratio(key1, key2);
}

// Validate that a provided transcript conforms to the powering sequences required for our structured reference string.
bool validate_transcript(
    G1 &g1_0,
    G2 &g2_0,
    std::vector<G1> const &g1_x,
    std::vector<G2> const &g2_x,
    std::vector<G1> const &g1_x_previous,
    std::vector<G2> const &g2_y)
{
    if (g1_x_previous.size() && g2_y.size())
    {
        std::cout << "Checking transcript was derived from previous participants..." << std::endl;
        if (!validate_transcript_derived_from_previous(g1_x_previous[0], g1_0, g2_y[0]))
        {
            throw std::runtime_error("Transcript was not derived from previous participants.");
        }
    }

    // Validate that the ratio between successive g1_x elements is defined by g2_x[0].
    std::cout << "Checking " << g1_x.size() << " G1 points..." << std::endl;
    if (!validate_polynomial_evaluation(g1_x, g2_0))
    {
        throw std::runtime_error("G1 elements failed.");
    }

    // Validate that the ratio between successive g2_x elements is defined by g1_x[0].
    std::cout << "Checking " << g2_x.size() << " G2 points..." << std::endl;
    if (g2_x.size() > 1 && !validate_polynomial_evaluation(g2_x, g1_0))
    {
        throw std::runtime_error("G2 elements failed.");
    }

    return true;
}

bool validate_manifest(streaming::Manifest const &previous, streaming::Manifest const &current)
{
    bool result = true;
    result &= previous.total_transcripts == current.total_transcripts;
    result &= previous.total_g1_points == current.total_g1_points;
    result &= previous.total_g2_points == current.total_g2_points;

    // Transcript must be the next in the sequence, or both 0.
    result &= (current.transcript_number == 0 && previous.transcript_number == 0) || (current.transcript_number == previous.transcript_number + 1);

    result &= current.num_g1_points <= previous.num_g1_points;
    result &= current.num_g2_points <= previous.num_g2_points;
    result &= current.start_from >= previous.start_from;

    if (!result)
    {
        throw std::runtime_error("Transcript manifest failed validation.");
    }

    return true;
}