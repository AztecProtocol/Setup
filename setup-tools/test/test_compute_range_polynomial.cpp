#include <gtest/gtest.h>

#include <libff/algebra/curves/alt_bn128/alt_bn128_pp.hpp>

#include <range/range_multi_exp.hpp>
#include <generate_h/range_multi_exp.hpp>
#include <generator/compute_generator_polynomial.hpp>
#include "test_utils.hpp"

#include <barretenberg/fields/fr.hpp>
#include <barretenberg/groups/g1.hpp>

// REMOVE
#include <barretenberg/groups/scalar_multiplication.hpp>

namespace bb = barretenberg;

/*
TEST(range, window)
{
    libff::init_alt_bn128_params();
    constexpr size_t DEGREE = 0x101;

    std::vector<libff::alt_bn128_Fr> generator_polynomial = generator::compute_generator_polynomial<libff::alt_bn128_Fr>(DEGREE);
    libff::alt_bn128_Fr x = libff::alt_bn128_Fr::random_element();
    libff::alt_bn128_Fr accumulator = x;
    std::vector<libff::alt_bn128_G1> g1_x;
    g1_x.reserve(DEGREE + 1);

    g1_x.emplace_back(libff::alt_bn128_G1::one());
    for (size_t i = 1; i < DEGREE + 1; ++i)
    {
        libff::alt_bn128_G1 pt = libff::alt_bn128_G1::one();
        pt = accumulator * pt;
        g1_x.emplace_back(pt);
        accumulator *= x;
    }

    libff::alt_bn128_G1 h = generate_h::batch_process_range(4, g1_x, generator_polynomial);

    for (size_t i = 0; i < DEGREE; ++i)
    {
        libff::alt_bn128_G1 process_result = batch_process_range(i, DEGREE, 4, &g1_x[0], &generator_polynomial[0]);
        libff::alt_bn128_G1 t0 = x * process_result;
        libff::alt_bn128_G1 t1 = (-libff::alt_bn128_Fr(i)) * process_result;
        libff::alt_bn128_G1 result = t0 + t1;
        result.to_affine_coordinates();
        h.to_affine_coordinates();
        test_utils::validate_g1_point<4>(result, h);
    }
}
*/

TEST(range, process_range)
{
    libff::init_alt_bn128_params();
    constexpr size_t kmax = 0x101;
    constexpr size_t DEGREE = kmax + 1;

    std::vector<Fr> generator_polynomial = generator::compute_generator_polynomial<libff::alt_bn128_Fr>(kmax);
    auto bc = reinterpret_cast<bb::fr::field_t *>(&generator_polynomial[0]);
    auto x = bb::fr::random_element();
    bb::fr::field_t accumulator = x;
    std::vector<bb::g1::affine_element> g1_x;
    g1_x.reserve(DEGREE + 1);

    g1_x.emplace_back(bb::g1::affine_one());
    for (size_t i = 1; i < DEGREE + 1; ++i)
    {
        bb::g1::affine_element pt = bb::g1::affine_one();
        pt = bb::g1::group_exponentiation(pt, accumulator);
        g1_x.emplace_back(pt);
        accumulator = bb::fr::mul(x, accumulator);
    }

    bb::g1::element h = generate_h::batch_process_range(DEGREE, 3, &g1_x[0], bc);

    for (size_t i = 0; i < DEGREE; ++i)
    {
        bb::fr::field_t fa = bb::fr::zero();
        bb::g1::element process_result = process_range(i, fa, &g1_x[0], bc, 0, DEGREE);
        bb::g1::element t0 = bb::g1::group_exponentiation(process_result, x);

        bb::fr::field_t bbi;
        bb::fr::to_montgomery_form({i, 0, 0, 0}, bbi);
        bb::fr::neg(bbi, bbi);

        bb::g1::element t1 = bb::g1::group_exponentiation(process_result, bbi);
        bb::g1::element r;
        bb::g1::add(t0, t1, r);

        bb::g1::affine_element result, expected;
        bb::g1::jacobian_to_affine(r, result);
        bb::g1::jacobian_to_affine(h, expected);
        for (size_t i = 0; i < 4; ++i)
        {
            EXPECT_EQ(result.x.data[i], h.x.data[i]);
            EXPECT_EQ(result.y.data[i], h.y.data[i]);
        }
    }
}

TEST(range, batch_process_range)
{
    libff::init_alt_bn128_params();
    constexpr size_t kmax = 0x101;
    constexpr size_t DEGREE = kmax + 1;

    std::vector<Fr> generator_polynomial = generator::compute_generator_polynomial<libff::alt_bn128_Fr>(kmax);
    auto bc = reinterpret_cast<bb::fr::field_t *>(&generator_polynomial[0]);
    auto x = bb::fr::random_element();
    bb::fr::field_t accumulator = x;
    std::vector<bb::g1::affine_element> g1_x;
    g1_x.reserve(DEGREE + 1);

    g1_x.emplace_back(bb::g1::affine_one());
    for (size_t i = 1; i < DEGREE + 1; ++i)
    {
        bb::g1::affine_element pt = bb::g1::affine_one();
        pt = bb::g1::group_exponentiation(pt, accumulator);
        g1_x.emplace_back(pt);
        accumulator = bb::fr::mul(x, accumulator);
    }

    bb::g1::element h = generate_h::batch_process_range(DEGREE, 3, &g1_x[0], bc);

    for (size_t i = 0; i < DEGREE; ++i)
    {
        bb::g1::element process_result = batch_process_range(i, DEGREE, 3, &g1_x[0], bc);
        bb::g1::element t0 = bb::g1::group_exponentiation(process_result, x);

        bb::fr::field_t bbi;
        bb::fr::to_montgomery_form({i, 0, 0, 0}, bbi);
        bb::fr::neg(bbi, bbi);

        bb::g1::element t1 = bb::g1::group_exponentiation(process_result, bbi);
        bb::g1::element r;
        bb::g1::add(t0, t1, r);

        bb::g1::affine_element result, expected;
        bb::g1::jacobian_to_affine(r, result);
        bb::g1::jacobian_to_affine(h, expected);
        for (size_t i = 0; i < 4; ++i)
        {
            EXPECT_EQ(result.x.data[i], h.x.data[i]);
            EXPECT_EQ(result.y.data[i], h.y.data[i]);
        }
    }
}