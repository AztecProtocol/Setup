#include <gtest/gtest.h>

#include <glob.h>

#include <iostream>
#include <gmp.h>

#include <libff/algebra/fields/field_utils.hpp>
#include <libff/algebra/fields/bigint.hpp>
#include <libff/algebra/fields/fp.hpp>
#include <libff/algebra/curves/alt_bn128/alt_bn128_pairing.hpp>
#include <libff/algebra/curves/alt_bn128/alt_bn128_g1.hpp>
#include <libff/algebra/curves/alt_bn128/alt_bn128_g2.hpp>
#include <libff/algebra/curves/alt_bn128/alt_bn128_init.hpp>
#include <libff/algebra/curves/alt_bn128/alt_bn128_pp.hpp>
#include <libff/algebra/curves/public_params.hpp>
#include <libff/algebra/curves/curve_utils.hpp>
#include <libff/common/profiling.hpp>

#include <setup/setup.hpp>
#include <setup/utils.hpp>
#include <setup/verifier.hpp>

#include "test_utils.hpp"

TEST(setup, batch_normalize_works)
{
    libff::init_alt_bn128_params();

    size_t N = 100;
    constexpr size_t num_limbs = sizeof(libff::alt_bn128_Fq) / GMP_NUMB_BYTES;

    std::vector<libff::alt_bn128_G1> points;
    std::vector<libff::alt_bn128_G1> normalized;
    std::vector<libff::alt_bn128_G1> dummy;

    points.reserve(100);
    normalized.reserve(100);
    for (size_t i = 0; i < N; ++i)
    {
        libff::alt_bn128_G1 point = libff::alt_bn128_G1::random_element();
        points.emplace_back(point);
        normalized.emplace_back(point);
        dummy.emplace_back(point);
    }
    utils::batch_normalize<libff::alt_bn128_Fq, libff::alt_bn128_G1>(0, N, &normalized[0], &dummy[0]);
    for (size_t i = 0; i < N; ++i)
    {
        points[i].to_affine_coordinates();
        test_utils::validate_g1_point<num_limbs>(points[i], normalized[i]);
    }
}

TEST(setup, same_ratio)
{
    libff::init_alt_bn128_params();
    size_t N = 100;
    std::vector<libff::alt_bn128_G1> points;
    points.reserve(N);
    libff::alt_bn128_Fr y = libff::alt_bn128_Fr::random_element();
    libff::alt_bn128_Fr accumulator = y;
    for (size_t i = 0; i < 100; ++i)
    {
        points.emplace_back(accumulator * libff::alt_bn128_G1::one());
        accumulator = accumulator * y;
    }
    verifier::VerificationKey<libff::alt_bn128_G2> g2_key;
    g2_key.lhs = y * libff::alt_bn128_G2::one();
    g2_key.rhs = libff::alt_bn128_G2::one();
    verifier::VerificationKey<libff::alt_bn128_G1> g1_key;

    verifier::same_ratio_preprocess<libff::alt_bn128_Fr, libff::alt_bn128_G1>(&points[0], g1_key, N);

    bool result = verifier::same_ratio<libff::alt_bn128_pp>(g1_key, g2_key);

    EXPECT_EQ(result, true);
}

TEST(setup, validate_polynomial_evaluation)
{
    libff::init_alt_bn128_params();
    size_t N = 100;
    std::vector<libff::alt_bn128_G1> points;
    points.reserve(N);
    libff::alt_bn128_Fr y = libff::alt_bn128_Fr::random_element();
    libff::alt_bn128_Fr accumulator = y;
    for (size_t i = 0; i < 100; ++i)
    {
        points.emplace_back(accumulator * libff::alt_bn128_G1::one());
        accumulator = accumulator * y;
    }
    libff::alt_bn128_G2 comparator = y * libff::alt_bn128_G2::one();

    bool result = verifier::validate_polynomial_evaluation<libff::alt_bn128_pp, libff::alt_bn128_G1, libff::alt_bn128_G2>(&points[0], comparator, N);

    EXPECT_EQ(result, true);
}

TEST(setup, validate_transcript)
{
    libff::init_alt_bn128_params();

    // constexpr size_t num_limbs = sizeof(libff::alt_bn128_Fq) / GMP_NUMB_BYTES;
    size_t N = 100;
    std::vector<libff::alt_bn128_G1> g1_x;
    std::vector<libff::alt_bn128_G1> g1_alpha_x;
    std::vector<libff::alt_bn128_G2> g2_x;
    std::vector<libff::alt_bn128_G2> g2_alpha_x;
    g1_x.reserve(N);
    g1_alpha_x.reserve(N);
    g2_x.reserve(N);
    g2_alpha_x.reserve(N);

    libff::alt_bn128_Fr y = libff::alt_bn128_Fr::random_element();
    libff::alt_bn128_Fr accumulator = y;
    libff::alt_bn128_Fr alpha = libff::alt_bn128_Fr::random_element();

    for (size_t i = 0; i < 100; ++i)
    {
        g1_x.emplace_back(accumulator * libff::alt_bn128_G1::one());
        g1_alpha_x.emplace_back(alpha * accumulator * libff::alt_bn128_G1::one());
        g2_x.emplace_back(accumulator * libff::alt_bn128_G2::one());
        g2_alpha_x.emplace_back(alpha * accumulator * libff::alt_bn128_G2::one());

        accumulator = accumulator * y;
    }

    bool result = verifier::validate_transcript<libff::alt_bn128_pp>(&g1_x[0], &g1_alpha_x[0], &g2_x[0], &g2_alpha_x[0], N);
    EXPECT_EQ(result, true);
}
