#include <gtest/gtest.h>

#include <iostream>
#include <gmp.h>

#include <libff/algebra/curves/alt_bn128/alt_bn128_g1.hpp>
#include <libff/algebra/curves/alt_bn128/alt_bn128_init.hpp>
#include <libff/algebra/curves/alt_bn128/alt_bn128_pairing.hpp>

#include <setup/setup.hpp>
#include <setup/utils.hpp>

TEST(setup, batch_normalize_works)
{
    size_t N = 100;
    libff::init_alt_bn128_params();
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
    printf("reached comparison stage\n");
    for (size_t i = 0; i < N; ++i)
    {
        points[i].to_affine_coordinates();
        libff::bigint<4UL> x = points[i].X.as_bigint();
        libff::bigint<4UL> y = points[i].Y.as_bigint();
        libff::bigint<4UL> z = points[i].Z.as_bigint();
        libff::bigint<4UL> x_result = normalized[i].X.as_bigint();
        libff::bigint<4UL> y_result = normalized[i].Y.as_bigint();
        libff::bigint<4UL> z_result = normalized[i].Z.as_bigint();
        for (size_t j = 0; j < 4; ++j)
        {
            EXPECT_EQ(x_result.data[j], x.data[j]);
            EXPECT_EQ(y_result.data[j], y.data[j]);
            EXPECT_EQ(z_result.data[j], z.data[j]);
        }
    }
}

