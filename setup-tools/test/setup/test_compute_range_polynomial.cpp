#include <gtest/gtest.h>

#include <libff/algebra/curves/alt_bn128/alt_bn128_pp.hpp>

#include <libfqfft/polynomial_arithmetic/basic_operations.hpp>

#include <range/range_multi_exp.hpp>
#include <generate_h/range_multi_exp.hpp>
#include <generator/compute_generator_polynomial.hpp>
#include "test_utils.hpp"

namespace
{
}
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
