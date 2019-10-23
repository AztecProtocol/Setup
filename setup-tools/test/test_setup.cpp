#include <gtest/gtest.h>

#include <setup/setup.hpp>
#include <setup/utils.hpp>
#include <verify/verifier.hpp>
#include <setup/setup.hpp>
#include "test_utils.hpp"

TEST(setup, batch_normalize_works)
{
    libff::init_alt_bn128_params();

    size_t N = 100;
    constexpr size_t num_limbs = sizeof(Fq) / GMP_NUMB_BYTES;

    std::vector<G1> points;
    std::vector<G1> normalized;
    std::vector<G1> dummy;

    points.reserve(100);
    normalized.reserve(100);
    for (size_t i = 0; i < N; ++i)
    {
        G1 point = G1::random_element();
        points.emplace_back(point);
        normalized.emplace_back(point);
        dummy.emplace_back(point);
    }
    utils::batch_normalize<Fq, G1>(0, N, &normalized[0], &dummy[0]);
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
    std::vector<G1> points(N, G1::one());
    Fr y = Fr::random_element();
    std::atomic<size_t> progress(0);
    compute_g1_thread(y, points, 0, 0, N, progress);

    VerificationKey<G2> g2_key;
    g2_key.lhs = y * G2::one();
    g2_key.rhs = G2::one();
    VerificationKey<G1> g1_key;

    g1_key = same_ratio_preprocess(points);

    bool result = same_ratio(g1_key, g2_key);

    EXPECT_EQ(result, true);
}

TEST(setup, validate_polynomial_evaluation)
{
    libff::init_alt_bn128_params();
    size_t N = 100;
    std::vector<G1> points(N, G1::one());
    Fr y = Fr::random_element();
    std::atomic<size_t> progress(0);
    compute_g1_thread(y, points, 0, 0, N, progress);
    G2 comparator = y * G2::one();

    bool result = validate_polynomial_evaluation(points, comparator);

    EXPECT_EQ(result, true);
}

TEST(setup, validate_transcript)
{
    libff::init_alt_bn128_params();

    constexpr size_t num_limbs = sizeof(Fq) / GMP_NUMB_BYTES;
    size_t N = 100;
    std::vector<G1> g1_x_prev, g1_x;
    std::vector<G2> g2_x_prev, g2_x;
    G2 g2_y;

    {
        Fr y = Fr::random_element();
        Fr accumulator = y;
        for (size_t i = 0; i < N; ++i)
        {
            g1_x_prev.emplace_back(G1::one());
            g2_x_prev.emplace_back(accumulator * G2::one());

            accumulator = accumulator * y;
        }
        std::atomic<size_t> progress(0);
        compute_g1_thread(y, g1_x_prev, 0, 0, N, progress);
    }

    {
        Fr y = Fr::random_element();
        Fr accumulator = y;
        for (size_t i = 0; i < N; ++i)
        {
            g1_x.emplace_back(g1_x_prev[i]);
            g2_x.emplace_back(accumulator * g2_x_prev[i]);

            accumulator = accumulator * y;
        }
        std::atomic<size_t> progress(0);
        compute_g1_thread(y, g1_x, 0, 0, N, progress);
        g2_y = libff::fixed_window_wnaf_exp<G2, num_limbs>(5, G2::one(), y.as_bigint());
    }

    bool result = validate_transcript(g1_x[0], g2_x[0], g1_x, g2_x, {g1_x_prev[0]}, {g2_y});
    EXPECT_EQ(result, true);
}
