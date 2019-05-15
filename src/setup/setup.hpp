#pragma once

#include <stddef.h>
#include <array>

namespace setup
{

    constexpr size_t POLYNOMIAL_DEGREE = 10000; // 0x1000000;

    // template <typename FieldT, typename G1, typename G2>
    // void compute_polynomial_evaluation_elements(FieldT& setup_key, G1* database, G2* elements);

    // template <typename FieldT, typename G1, typename G2>
    // void compute_challenge_responses(FieldT& setup_key, G1* database, G2* elements);
    template <typename FieldT, typename Field2T, typename ScalarT, typename Group1T, typename Group2T>
    void run_setup(bool init = false);
};
#include "setup.tcc"

