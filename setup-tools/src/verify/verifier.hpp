/**
 * Setup
 * Copyright Spilsbury Holdings 2019
 **/
#pragma once

#include <aztec_common/streaming_transcript.hpp>

template <typename GroupT>
struct VerificationKey
{
    GroupT lhs;
    GroupT rhs;
};

bool same_ratio(VerificationKey<G1> const &g1_key, VerificationKey<G2> const &g2_key);

template <typename GroupT>
VerificationKey<GroupT> same_ratio_preprocess(std::vector<GroupT> const &g_x);

bool validate_polynomial_evaluation(std::vector<G1> const &evaluation, G2 const &comparator);

bool validate_polynomial_evaluation(std::vector<G2> const &evaluation, G1 const &comparator);

bool validate_transcript(
    G1 &g1_0,
    G2 &g2_0,
    std::vector<G1> const &g1_x,
    std::vector<G2> const &g2_x,
    std::vector<G1> const &g1_x_previous,
    std::vector<G2> const &g2_y);

bool validate_manifest(streaming::Manifest const &manifest, size_t total_g1_points, size_t total_g2_points, size_t points_per_transcript, size_t transcript_number);