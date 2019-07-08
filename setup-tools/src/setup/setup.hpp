/**
 * Setup
 * Copyright Spilsbury Holdings 2019
 *
 **/
#pragma once

#include <stddef.h>
#include <array>

namespace setup
{

constexpr size_t POLYNOMIAL_DEGREE_SONIC = 0x1;     // 0x1000000;
constexpr size_t POLYNOMIAL_DEGREE_AZTEC = 0x10000; // 33 million // 0x1000000;

// template <typename FieldT, typename G1, typename G2>
// void compute_polynomial_evaluation_elements(FieldT& setup_key, G1* database, G2* elements);

// template <typename FieldT, typename G1, typename G2>
// void compute_challenge_responses(FieldT& setup_key, G1* database, G2* elements);
template <typename ppT>
void run_setup();
}; // namespace setup
#include "setup.tcc"
