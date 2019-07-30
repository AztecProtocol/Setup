/**
 * Setup
 * Copyright Spilsbury Holdings 2019
 **/
#pragma once

#include <thread>
#include <future>
#include <numeric>
#include <algorithm>
#include <glob.h>
#include <libff/common/profiling.hpp>
#include <libff/common/utils.hpp>
#include <libff/algebra/curves/public_params.hpp>
#include <libff/algebra/curves/curve_utils.hpp>
#include <libff/common/profiling.hpp>
#include <libff/algebra/scalar_multiplication/multiexp.hpp>

namespace verifier
{
namespace
{

template <typename ppT>
using Fq = libff::Fq<ppT>;

template <typename ppT>
using Fqe = libff::Fqe<ppT>;

template <typename ppT>
using G1 = libff::G1<ppT>;

template <typename ppT>
using G2 = libff::G2<ppT>;

template <typename ppT>
using Fr = libff::Fr<ppT>;

} // namespace

template <typename GroupT>
struct VerificationKey
{
    GroupT lhs;
    GroupT rhs;
};

template <typename FieldT, typename G1>
VerificationKey<G1> same_ratio_preprocess_thread(std::vector<G1> const &g1_points, std::vector<FieldT> const &scalars, size_t start_from, size_t num)
{
    VerificationKey<G1> key;

    key.lhs = libff::multi_exp<G1, FieldT, libff::multi_exp_method_bos_coster>(
        g1_points.cbegin() + start_from,
        g1_points.cbegin() + start_from + num - 1,
        scalars.cbegin() + start_from,
        scalars.cbegin() + start_from + num - 1,
        1);

    key.rhs = libff::multi_exp<G1, FieldT, libff::multi_exp_method_bos_coster>(
        g1_points.cbegin() + start_from + 1,
        g1_points.cbegin() + start_from + num,
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
template <typename FieldT, typename G1>
VerificationKey<G1> same_ratio_preprocess(std::vector<G1> const &g1_points)
{
    FieldT challenge = FieldT::random_element();

    std::vector<FieldT> scalars(g1_points.size());
    scalars[0] = challenge;
    for (size_t i = 1; i < scalars.size(); ++i)
    {
        scalars[i] = scalars[i - 1] * challenge;
    }

    size_t num_threads = std::thread::hardware_concurrency();
    num_threads = num_threads ? num_threads : 4;
    size_t thread_range = g1_points.size() / num_threads;
    size_t leftovers = g1_points.size() % thread_range;
    std::vector<std::thread> threads;
    std::vector<std::future<VerificationKey<G1>>> results;

    for (uint i = 0; i < num_threads; i++)
    {
        size_t start_from = (i * thread_range);
        if (i == num_threads - 1)
        {
            thread_range += leftovers;
        }
        results.push_back(std::async(std::launch::async, same_ratio_preprocess_thread<FieldT, G1>, std::ref(g1_points), std::ref(scalars), start_from, thread_range));
    }

    VerificationKey<G1> key(results[0].get());
    for (uint i = 1; i < results.size(); i++)
    {
        auto r = results[i].get();
        key.lhs = key.lhs + r.lhs;
        key.rhs = key.rhs + r.rhs;
    }
    return key;
}

// Validate that g1_key.lhs * g2_key.lhs == g1_key.rhs * g2_key.rhs
template <typename ppT>
bool same_ratio(VerificationKey<G1<ppT>> &g1_key, VerificationKey<G2<ppT>> &g2_key)
{
// turn off profiling printf statements when computing a pairing
#ifndef ENABLE_LIBFF_PROFILING
    libff::inhibit_profiling_info = true;
    libff::inhibit_profiling_counters = true;
#endif // ENABLE_LIBFF_PROFILING

    libff::G1_precomp<ppT> g1_lhs = ppT::precompute_G1(-g1_key.lhs);
    libff::G1_precomp<ppT> g1_rhs = ppT::precompute_G1(g1_key.rhs);

    // lhs * delta = rhs * one
    libff::G2_precomp<ppT> g2_lhs = ppT::precompute_G2(g2_key.lhs);
    libff::G2_precomp<ppT> g2_rhs = ppT::precompute_G2(g2_key.rhs);

    libff::Fqk<ppT> miller_result = ppT::double_miller_loop(g1_lhs, g2_lhs, g1_rhs, g2_rhs);
    libff::GT<ppT> result = ppT::final_exponentiation(miller_result);
    return result == libff::GT<ppT>::one();
}

// We want to validate that a vector of points corresponds to the terms [x, x^2, ..., x^n] of an indeterminate x
// and a random variable z
// We want to construct two sequences
// 1: A = x.z + x^2.z^2 + ... + x^(n-1).z^(n-1)
// 2: B = x^2.z + ... + x^n.z^(n-1)
// Because every term is multiplied by an independant random variable, we can treat each term as distinct.
// Once we have A and B, we can validate that A*x = B via a pairing check.
// This validates that our original vector represents the powering sequence that we desire
template <typename ppT, typename G1, typename G2>
bool validate_polynomial_evaluation(std::vector<G1> const &evaluation, G2 const &comparator)
{
    VerificationKey<G2> delta;

    delta.lhs = comparator;
    delta.rhs = G2::one();

    VerificationKey<G1> key = same_ratio_preprocess<Fq<ppT>>(evaluation);

    // is this the compiler equivalent of "it's fine! nobody panic! we'll just edit it out in post..."
    if constexpr (sizeof(G2) > sizeof(G1))
    {
        // (same_ratio requires 1st argument to be G1, 2nd to be G2)
        // (the template abstraction breaks down when computing the pairing,
        //  as `miller_loop` has an explicit ordering of its arguments)
        return same_ratio<ppT>(key, delta);
    }
    else
    {
        return same_ratio<ppT>(delta, key);
    }
}

// Validate that a provided transcript conforms to the powering sequences required for our structured reference string
template <typename ppT, typename G1, typename G2>
bool validate_transcript(std::vector<G1> const &g1_x, std::vector<G2> const &g2_x, G1 &g1_0, G2 &g2_0)
{
    bool result = true;

    // validate that the ratio between successive g1_x elements is defined by g2_x[0]
    result &= validate_polynomial_evaluation<ppT>(g1_x, g2_0);

    // validate that the ratio between successive g2_x elements is defined by g1_x[0]
    if (g2_x.size() > 1) {
        result &= validate_polynomial_evaluation<ppT>(g2_x, g1_0);
    }

    return result;
}
} // namespace verifier
