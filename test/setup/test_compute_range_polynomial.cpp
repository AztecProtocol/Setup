#include <gtest/gtest.h>

#include <libff/algebra/curves/alt_bn128/alt_bn128_pp.hpp>

#include <libfqfft/polynomial_arithmetic/basis_change.hpp>
#include <libfqfft/evaluation_domain/evaluation_domain.hpp>
#include <libfqfft/evaluation_domain/domains/arithmetic_sequence_domain.hpp>

#include <range/window.hpp>

#include "test_utils.hpp"

TEST(range, window)
{
    constexpr size_t RANGE = 0x100;
    constexpr size_t DEGREE = 0x100;
    constexpr size_t WINDOW_DEGREE = 0x20;
    using WindowInstance = Window<libff::alt_bn128_Fr, libff::alt_bn128_G1, RANGE, WINDOW_DEGREE>;

    std::vector<std::vector<std::vector<libff::alt_bn128_Fr>>> subproduct_tree;

    libfqfft::compute_subproduct_tree(log2(DEGREE), subproduct_tree);

    std::vector<libff::alt_bn128_Fr> generator_polynomial = subproduct_tree[log2(DEGREE)][0];
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


    WindowInstance window = WindowInstance(&g1_x, &generator_polynomial, 0, 0);

    for (size_t i = 0; i < (DEGREE / WINDOW_DEGREE) - 1; ++i)
    {
        window.process();
        window.advance_window();
    }
    window.process();

    std::vector<libff::alt_bn128_G1>& group_accumulators = *window.get_group_accumulators();

    libff::alt_bn128_G1 h = libff::alt_bn128_G1::zero();
    for (size_t i = 0; i < generator_polynomial.size(); ++i)
    {
        libff::alt_bn128_G1 pt = generator_polynomial[i] * g1_x[i];
        h = h + pt;
    }

    for (size_t i = 0; i < RANGE; ++i)
    {
        libff::alt_bn128_G1 t0 = x * group_accumulators[i];
        libff::alt_bn128_G1 t1 = (-libff::alt_bn128_Fr(i)) * group_accumulators[i];
        libff::alt_bn128_G1 result = t0 + t1;
        result.to_affine_coordinates();
        h.to_affine_coordinates();
        test_utils::validate_g1_point<4>(result, h);
    }
}

