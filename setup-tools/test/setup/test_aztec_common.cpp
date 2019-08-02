
#include <gtest/gtest.h>

#include <aztec_common/streaming.hpp>
#include <aztec_common/streaming_transcript.hpp>
#include <aztec_common/streaming_g1.hpp>
#include <aztec_common/streaming_g2.hpp>
#include "test_utils.hpp"

TEST(aztec_common, variable_size_checks)
{
    libff::init_alt_bn128_params();
    size_t fq_bytes = sizeof(Fq);
    size_t fr_bytes = sizeof(Fr);
    size_t g1_bytes = sizeof(G1);
    size_t g2_bytes = sizeof(G2);

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
    expected[0] = *(mp_limb_t *)(&buffer[0]);
    expected[1] = *(mp_limb_t *)(&buffer[8]);
    expected[2] = *(mp_limb_t *)(&buffer[16]);
    expected[3] = *(mp_limb_t *)(&buffer[24]);
    EXPECT_EQ(expected[3], (mp_limb_t)0x8899aabbccddeeffUL);
    EXPECT_EQ(expected[2], (mp_limb_t)0x0011223344556677UL);
    EXPECT_EQ(expected[1], (mp_limb_t)0x8796a5b4c3d2e1f0UL);
    EXPECT_EQ(expected[0], (mp_limb_t)0x0f1e2d3c4b5a6978UL);
}

TEST(streaming, write_g1_elements_to_buffer)
{
    constexpr size_t N = 100;
    constexpr size_t element_size = sizeof(Fq) * 2;
    constexpr size_t buffer_size = N * element_size;
    constexpr size_t num_limbs = sizeof(Fq) / GMP_NUMB_BYTES;

    libff::init_alt_bn128_params();
    std::vector<G1> result;
    std::vector<G1> expected;
    result.reserve(N);
    expected.reserve(N);
    char buffer[buffer_size];
    for (size_t i = 0; i < N; ++i)
    {
        G1 point = G1::random_element();
        point.to_affine_coordinates();
        expected.emplace_back(point);
    }

    streaming::write_g1_elements_to_buffer(expected, buffer);

    streaming::read_g1_elements_from_buffer(result, buffer, buffer_size);

    for (size_t i = 0; i < N; ++i)
    {
        test_utils::validate_g1_point<num_limbs>(result[i], expected[i]);
    }
}

TEST(streaming, write_g2_elements_to_buffer)
{
    constexpr size_t N = 100;
    constexpr size_t element_size = sizeof(Fqe) * 2;
    constexpr size_t buffer_size = N * element_size;
    constexpr size_t num_limbs = sizeof(Fq) / GMP_NUMB_BYTES;

    libff::init_alt_bn128_params();
    std::vector<G2> result;
    std::vector<G2> expected;
    result.reserve(N);
    expected.reserve(N);
    char buffer[buffer_size];
    for (size_t i = 0; i < N; ++i)
    {
        G2 point = G2::random_element();
        point.to_affine_coordinates();
        expected.emplace_back(point);
    }
    streaming::write_g2_elements_to_buffer(expected, buffer);

    streaming::read_g2_elements_from_buffer(result, buffer, buffer_size);

    for (size_t i = 0; i < N; ++i)
    {
        test_utils::validate_g2_point<num_limbs>(result[i], expected[i]);
    }
}

TEST(streaming, read_write_transcripts)
{
    constexpr size_t G1_N = 100;
    constexpr size_t G2_N = 2;
    constexpr size_t num_limbs = sizeof(Fq) / GMP_NUMB_BYTES;

    libff::init_alt_bn128_params();
    std::vector<G1> g1_result;
    std::vector<G1> g1_expected;
    std::vector<G2> g2_result;
    std::vector<G2> g2_expected;
    streaming::Manifest manifest;

    manifest.transcript_number = 0;
    manifest.total_transcripts = 1;
    manifest.total_g1_points = G1_N;
    manifest.total_g2_points = G2_N;
    manifest.num_g1_points = G1_N;
    manifest.num_g2_points = G2_N;
    manifest.start_from = 0;

    for (size_t i = 0; i < G1_N; ++i)
    {
        G1 g1_point = G1::random_element();
        g1_point.to_affine_coordinates();
        g1_expected.emplace_back(g1_point);
    }
    for (size_t i = 0; i < G2_N; ++i)
    {
        G2 g2_point = G2::random_element();
        g2_point.to_affine_coordinates();
        g2_expected.emplace_back(g2_point);
    }

    streaming::write_transcript(g1_expected, g2_expected, manifest, "/tmp/rwt_test");
    streaming::read_transcript(g1_result, g2_result, manifest, "/tmp/rwt_test");

    for (size_t i = 0; i < G1_N; ++i)
    {
        test_utils::validate_g1_point<num_limbs>(g1_result[i], g1_expected[i]);
    }
    for (size_t i = 0; i < G2_N; ++i)
    {
        test_utils::validate_g2_point<num_limbs>(g2_result[i], g2_expected[i]);
    }
}
