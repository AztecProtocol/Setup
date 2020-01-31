#include <iostream>
#include <aztec_common/streaming_range.hpp>
#include <barretenberg/fields/fr.hpp>
#include <barretenberg/fields/fq.hpp>
#include <barretenberg/groups/g1.hpp>
#include <barretenberg/groups/g2.hpp>
#include <barretenberg/fields/fq2.hpp>
#include <barretenberg/fields/fq12.hpp>
#include <barretenberg/groups/pairing.hpp>
#include <barretenberg/groups/scalar_multiplication.hpp>

namespace bb = barretenberg;

inline uint32_t get_msb(uint32_t v)
{
    static const uint32_t MultiplyDeBruijnBitPosition[32] = { 0,  9,  1,  10, 13, 21, 2,  29, 11, 14, 16,
                                                              18, 22, 25, 3,  30, 8,  12, 20, 28, 15, 17,
                                                              24, 7,  19, 27, 23, 6,  26, 5,  4,  31 };

    v |= v >> 1; // first round down to one less than a power of 2
    v |= v >> 2;
    v |= v >> 4;
    v |= v >> 8;
    v |= v >> 16;

    return MultiplyDeBruijnBitPosition[static_cast<uint32_t>(v * static_cast<uint32_t>(0x07C4ACDD)) >> static_cast<uint32_t>(27)];
}

bb::g2::affine_element t2;
bb::g1::affine_element h;
const auto init = [](){
    t2.x.c0 = {{ 0x7e231fec938883b0, 0x9f5944073b32078b, 0xbc89b5b398b5974e, 0x0118c4d5b837bcc2 }};
    t2.x.c1 = {{ 0x4efe30fac09383c1, 0xea51d87a358e038b, 0xe7ff4e580791dee8, 0x260e01b251f6f1c7 }};
    t2.y.c0 = {{ 0x854a87d4dacc5e55, 0x11e6dd3f96e6cea2, 0x56475b4214e5615e, 0x22febda3c0c0632a }};
    t2.y.c1 = {{ 0xee413c80da6a5fe4, 0x9cf2a04641f99ba4, 0xd25156c1bb9a7285, 0x04fc6369f7110fe3 }};

    h.x = {{ 0x34c705638441c4b9, 0xf7473acbe61df671, 0x5d56d9653aed9dc7, 0x00164b60d0fa1eab }};
    h.y = {{ 0xf0442fce79416cf0, 0x08611b4adeb4b838, 0x7254dfb9be2cb4e9, 0x2bb1b9b55ffdcf2d }};
    bb::fq::to_montgomery_form(h.x, h.x);
    bb::fq::to_montgomery_form(h.y, h.y);
    bb::fq::to_montgomery_form(t2.x.c0, t2.x.c0);
    bb::fq::to_montgomery_form(t2.x.c1, t2.x.c1);
    bb::fq::to_montgomery_form(t2.y.c0, t2.y.c0);
    bb::fq::to_montgomery_form(t2.y.c1, t2.y.c1);
    return 1;
}();


/**
 * verifies that all range proof points are valid
 * 1st argument points to range proof database: "../range_db/"
 * not included in the repo because it's 305MB large.
 * Can be acquired from https://s3.console.aws.amazon.com/s3/buckets/aztec-ignition/MAIN%2520IGNITION/range_proofs/
 **/ 
int main(int argc, char **argv)
{
    const std::string generator_path = argv[1];
    constexpr uint32_t NUM_POINTS = 10000001;
    std::vector<bb::g1::affine_element> points;
    points.resize(NUM_POINTS);
    printf("reading points \n");
    streaming::read_file(generator_path, points);


    std::vector<bb::g1::element> right_points;
    right_points.reserve(NUM_POINTS);
    printf("accumulating g1 points \n");
    for (uint32_t i = 0; i < static_cast<uint32_t>(points.size()); ++i)
    {
        uint32_t k = static_cast<uint32_t>(i);
        bb::g1::element mu_k_plus_h;
        bb::g1::set_infinity(mu_k_plus_h);
        const uint32_t max_bits = get_msb(static_cast<uint32_t>(k)) + 1;
        for (uint32_t j = max_bits; j <= max_bits; --j)
        {
            bb::g1::dbl(mu_k_plus_h, mu_k_plus_h);
            if (((k >> j) & 1) == 1)
            {
                bb::g1::mixed_add(mu_k_plus_h, points[i], mu_k_plus_h);
            }
        }
        bb::g1::mixed_add(mu_k_plus_h, h, mu_k_plus_h);
        right_points.emplace_back(mu_k_plus_h);
    }
    bb::g1::batch_normalize(&right_points[0], NUM_POINTS);
    std::vector<bb::g1::affine_element> right_points_affine;
    right_points_affine.resize(NUM_POINTS);
    for (size_t i = 0; i < NUM_POINTS; ++i)
    {
        right_points_affine[i].x = right_points[i].x;
        right_points_affine[i].y = right_points[i].y;
    }

    bb::fr::field_t alpha = bb::fr::random_element();
    bb::fr::field_t work_alpha = alpha;
    std::vector<bb::fr::field_t> scalars_left;
    std::vector<bb::fr::field_t> scalars_right;
    scalars_left.reserve(NUM_POINTS);
    scalars_right.reserve(NUM_POINTS);
    printf("generating scalars \n");
    for (size_t i = 0; i < NUM_POINTS; ++i)
    {
        scalars_left.push_back(work_alpha);
        scalars_right.push_back(work_alpha);
        bb::fr::__mul(work_alpha, alpha, work_alpha);
    }
    printf("performing multiexp\n");
    bb::g1::element lhs = bb::scalar_multiplication::pippenger_low_memory(&scalars_left[0], &points[0], NUM_POINTS);
    bb::g1::element rhs = bb::scalar_multiplication::pippenger_low_memory(&scalars_right[0], &right_points_affine[0], NUM_POINTS);
    printf("evaluating pairing \n");
    bb::g1::affine_element left;
    bb::g1::affine_element right;
    bb::g1::jacobian_to_affine(lhs, left);
    bb::g1::jacobian_to_affine(rhs, right);

    bb::g1::affine_element P[2];
    bb::g2::affine_element Q[2];
    P[0] = left;
    P[1] = right;
    Q[0] = t2;
    Q[1] = bb::g2::affine_one();
    bb::g1::neg(P[0], P[0]);
    bb::fq12::fq12_t out = bb::pairing::reduced_ate_pairing_batch(P, Q, 2);
    bool result = bb::fq12::eq(out, bb::fq12::one());

    if (!result)
    {
        throw std::runtime_error("pairing check failed!");
    }
    else
    {
        printf("range points valid! \n");
    }
}