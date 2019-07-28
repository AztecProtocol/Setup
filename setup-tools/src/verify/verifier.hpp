/**
 * Setup
 * Copyright Spilsbury Holdings 2019
 **/
#pragma once

#include <glob.h>
#include <libff/common/profiling.hpp>
#include <libff/common/utils.hpp>
#include <libff/algebra/curves/public_params.hpp>
#include <libff/algebra/curves/curve_utils.hpp>
#include <libff/common/profiling.hpp>

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

// We want to validate that a vector of points corresponds to the terms [x, x^2, ..., x^n]
// of an indeterminate x and a random variable z
// Update the verification key so that...
// key.lhs = x.z + x^2.z^2 + ... + x^(n-1).z^(n-1)
// key.rhs = x^2.z + ... + x^n.z^(n-1)
template <typename FieldT, typename GroupT>
void same_ratio_preprocess(GroupT *g1_points, VerificationKey<GroupT> &key, size_t polynomial_degree)
{
    FieldT challenge = FieldT::random_element();
    FieldT scalar_multiplier = challenge;
    GroupT rhs = GroupT::zero();
    GroupT lhs = scalar_multiplier * g1_points[0];

    for (size_t i = 1; i < polynomial_degree - 1; ++i)
    {
        rhs = rhs + (scalar_multiplier * g1_points[i]);
        scalar_multiplier = scalar_multiplier * challenge;
        lhs = lhs + (scalar_multiplier * g1_points[i]);
        // accumulator = accumulator + (scalar_multiplier * g1_points[i]);
    }
    rhs = rhs + scalar_multiplier * g1_points[polynomial_degree - 1];
    // scalar_multiplier = scalar_multiplier.squared();
    key.rhs = rhs; // accumulator + (scalar_multiplier * g1_points[polynomial_degree - 1]);
    key.lhs = lhs; // accumulator + (challenge * g1_points[0]);
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
template <typename ppT, typename Group1T, typename Group2T>
bool validate_polynomial_evaluation(Group1T *evaluation, Group2T comparator, size_t polynomial_degree)
{
    VerificationKey<Group1T> key;
    VerificationKey<Group2T> delta;

    delta.lhs = comparator;
    delta.rhs = Group2T::one();

    same_ratio_preprocess<Fq<ppT>, Group1T>(evaluation, key, polynomial_degree);

    // is this the compiler equivalent of "it's fine! nobody panic! we'll just edit it out in post..."
    if constexpr (sizeof(Group2T) > sizeof(Group1T))
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
template <typename ppT>
bool validate_transcript(G1<ppT> *g1_x, G2<ppT> *g2_x, size_t polynomial_degree)
{
    bool result = true;

    // validate that the ratio between successive g1_x elements is defined by g2_x[0]
    result &= validate_polynomial_evaluation<ppT, G1<ppT>, G2<ppT>>(g1_x, g2_x[0], polynomial_degree);

    // validate that the ratio between successive g2_x elements is defined by g1_x[0]
    result &= validate_polynomial_evaluation<ppT, G2<ppT>, G1<ppT>>(g2_x, g1_x[0], polynomial_degree);

    return result;
}
} // namespace verifier