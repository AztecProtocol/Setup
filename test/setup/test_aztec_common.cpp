
#include <gtest/gtest.h>

#include <iostream>
#include <gmp.h>

#include <libff/algebra/fields/bigint.hpp>
#include <libff/algebra/curves/alt_bn128/alt_bn128_g1.hpp>
#include <libff/algebra/curves/alt_bn128/alt_bn128_g2.hpp>
#include <libff/algebra/curves/alt_bn128/alt_bn128_init.hpp>
#include <libff/algebra/curves/alt_bn128/alt_bn128_pairing.hpp>

#include <aztec_common/streaming.hpp>

template <size_t N>
void validate_g1_point(libff::alt_bn128_G1& result, libff::alt_bn128_G1& expected)
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
void validate_g2_point(libff::alt_bn128_G2& result, libff::alt_bn128_G2& expected)
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

TEST(aztec_common, variable_size_checks)
{
    libff::init_alt_bn128_params();
    size_t fq_bytes = sizeof(libff::alt_bn128_Fq);
    size_t fr_bytes = sizeof(libff::alt_bn128_Fr);
    size_t g1_bytes = sizeof(libff::alt_bn128_G1);
    size_t g2_bytes = sizeof(libff::alt_bn128_G2);

    EXPECT_EQ(fq_bytes, 32);
    EXPECT_EQ(fr_bytes, 32);
    EXPECT_EQ(g1_bytes, 96);
    EXPECT_EQ(g2_bytes, 192);
}

TEST(streaming, write_bigint_to_buffer)
{
    libff::bigint<4> input;
    input.data[3] = (mp_limb_t)0xffeeddccbbaa9988UL;
    input.data[2] = (mp_limb_t)0x7766554433221100UL;
    input.data[1] = (mp_limb_t)0xf0e1d2c3b4a59687UL;
    input.data[0] = (mp_limb_t)0x78695a4b3c2d1e0fUL;
    char buffer[sizeof(mp_limb_t) * 4];
    streaming::write_bigint_to_buffer<4>(input, &buffer[0]);

    mp_limb_t expected[4];
    expected[0] = *(mp_limb_t*)(&buffer[0]);
    expected[1] = *(mp_limb_t*)(&buffer[8]);
    expected[2] = *(mp_limb_t*)(&buffer[16]);
    expected[3] = *(mp_limb_t*)(&buffer[24]);
    EXPECT_EQ(expected[3], (mp_limb_t)0x8899aabbccddeeffUL);
    EXPECT_EQ(expected[2], (mp_limb_t)0x0011223344556677UL);
    EXPECT_EQ(expected[1], (mp_limb_t)0x8796a5b4c3d2e1f0UL);
    EXPECT_EQ(expected[0], (mp_limb_t)0x0f1e2d3c4b5a6978UL);
}

TEST(streaming, write_g1_elements_to_buffer)
{
    constexpr size_t N = 100;
    constexpr size_t element_size = sizeof(libff::alt_bn128_Fq) * 2;
    constexpr size_t buffer_size = N * element_size;
    constexpr size_t num_limbs = sizeof(libff::alt_bn128_Fq) / GMP_NUMB_BYTES;

    libff::init_alt_bn128_params();
    std::vector<libff::alt_bn128_G1> result;
    std::vector<libff::alt_bn128_G1> expected;
    result.reserve(N);
    expected.reserve(N);
    char buffer[buffer_size];
    char* buffer_ptr = &buffer[0];
    for (size_t i = 0; i < N; ++i)
    {
        libff::alt_bn128_G1 point = libff::alt_bn128_G1::random_element();
        point.to_affine_coordinates();
        result.emplace_back(point);
        expected.emplace_back(point);
        streaming::write_g1_element_to_buffer(point, buffer_ptr);
        buffer_ptr += element_size;
    }

    buffer_ptr = &buffer[0];
    streaming::read_g1_elements_from_buffer<libff::alt_bn128_Fq, libff::alt_bn128_G1>(&result[0], buffer_ptr, buffer_size);

    for (size_t i = 0; i < N; ++i)
    {
        validate_g1_point<num_limbs>(result[i], expected[i]);
    }
}


TEST(streaming, write_g2_elements_to_buffer)
{
    constexpr size_t N = 1;
    constexpr size_t element_size = sizeof(libff::alt_bn128_Fq) * 4;
    constexpr size_t buffer_size = N * element_size;
    constexpr size_t num_limbs = sizeof(libff::alt_bn128_Fq) / GMP_NUMB_BYTES;

    libff::init_alt_bn128_params();
    std::vector<libff::alt_bn128_G2> result;
    std::vector<libff::alt_bn128_G2> expected;
    result.reserve(N);
    expected.reserve(N);
    char buffer[buffer_size];
    char* buffer_ptr = &buffer[0];
    for (size_t i = 0; i < N; ++i)
    {
        libff::alt_bn128_G2 point = libff::alt_bn128_G2::random_element();
        point.to_affine_coordinates();
        result.emplace_back(point);
        expected.emplace_back(point);
        streaming::write_g2_element_to_buffer(point, buffer_ptr);
        buffer_ptr += element_size;
    }

    buffer_ptr = &buffer[0];
    streaming::read_g2_elements_from_buffer<libff::alt_bn128_Fq, libff::alt_bn128_G2>(&result[0], buffer_ptr, buffer_size);

    for (size_t i = 0; i < N; ++i)
    {
        validate_g2_point<num_limbs>(result[i], expected[i]);
    }
}
