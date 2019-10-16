#pragma once

#include "stddef.h"

#include <libff/algebra/curves/alt_bn128/alt_bn128_g1.hpp>
#include <libff/algebra/curves/alt_bn128/alt_bn128_g2.hpp>

namespace test_utils
{
template <size_t N>
void validate_g1_point(libff::alt_bn128_G1 &result, libff::alt_bn128_G1 &expected)
{
    libff::bigint<N> result_x = result.X.as_bigint();
    libff::bigint<N> result_y = result.Y.as_bigint();
    libff::bigint<N> expected_x = expected.X.as_bigint();
    libff::bigint<N> expected_y = expected.Y.as_bigint();

    for (size_t i = 0; i < N; ++i)
    {
        EXPECT_EQ(result_x.data[i], expected_x.data[i]);
        EXPECT_EQ(result_y.data[i], expected_y.data[i]);
    }
}

template <size_t N>
void validate_g2_point(libff::alt_bn128_G2 &result, libff::alt_bn128_G2 &expected)
{
    libff::bigint<N> result_x0 = result.X.c0.as_bigint();
    libff::bigint<N> result_y0 = result.Y.c0.as_bigint();
    libff::bigint<N> result_x1 = result.X.c1.as_bigint();
    libff::bigint<N> result_y1 = result.Y.c1.as_bigint();

    libff::bigint<N> expected_x0 = expected.X.c0.as_bigint();
    libff::bigint<N> expected_y0 = expected.Y.c0.as_bigint();
    libff::bigint<N> expected_x1 = expected.X.c1.as_bigint();
    libff::bigint<N> expected_y1 = expected.Y.c1.as_bigint();

    for (size_t i = 0; i < N; ++i)
    {
        EXPECT_EQ(result_x0.data[i], expected_x0.data[i]);
        EXPECT_EQ(result_y0.data[i], expected_y0.data[i]);
        EXPECT_EQ(result_x1.data[i], expected_x1.data[i]);
        EXPECT_EQ(result_y1.data[i], expected_y1.data[i]);
    }
}
} // namespace utils