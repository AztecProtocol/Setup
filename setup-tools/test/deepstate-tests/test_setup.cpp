#include <setup/setup.hpp>
#include <setup/utils.hpp>
#include <verify/verifier.hpp>
#include "test_utils.hpp"

#include <deepstate/DeepState.hpp>

using namespace deepstate;


/* Setup_BoringBatchNormalizeWorks
 *
 * 		Concrete test for generating a vector of
 *		random G1 Jacobian points, normalizing to affine
 *		coordinates and comparing.
 */
TEST(Setup, BoringBatchNormalizeWorks)
{
    constexpr size_t N = 100;
    constexpr size_t num_limbs = sizeof(Fq) / GMP_NUMB_BYTES;

    libff::init_alt_bn128_params();

    std::vector<G1> points;
    std::vector<G1> normalized;
    std::vector<G1> dummy;

    points.reserve(N);
    normalized.reserve(N);

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


/* Setup_BatchNormalize
 *
 * 	 	Testing normalization to affine coordinate using a
 *		single G1 point.
 */
TEST(Setup, BatchNormalize)
{
    constexpr size_t num_limbs = sizeof(Fq) / GMP_NUMB_BYTES;

    libff::init_alt_bn128_params();

    std::vector<G1> points;
    std::vector<G1> normalized;
    std::vector<G1> dummy;

    points.reserve(1);
    normalized.reserve(1);

	// generate one point per run
    G1 point = test_utils::DeepState_G1();

	points.emplace_back(point);
    normalized.emplace_back(point);
    dummy.emplace_back(point);

    utils::batch_normalize<Fq, G1>(0, 1, &normalized[0], &dummy[0]);

	// convert jacobian point to affine coordinates, and compare
    points[0].to_affine_coordinates();
    test_utils::validate_g1_point<num_limbs>(points[0], normalized[0]);
}


/* Setup_BoringSameRatioPreprocess
 *
 * 		Tests polynomial evaluation validation using
 *		generated random field element and a pairing check.
 */
TEST(Setup, BoringSameRatioPreprocess)
{
    libff::init_alt_bn128_params();

    size_t N = 100;
    std::vector<G1> points;
    points.reserve(N);

    Fr y = Fr::random_element();
    Fr accumulator = y;

    for (size_t i = 0; i < N; ++i)
    {
        points.emplace_back(accumulator * G1::one());
        accumulator = accumulator * y;
    }

    VerificationKey<G1> g1_key;
    VerificationKey<G2> g2_key;

    g2_key.lhs = y * G2::one();
    g2_key.rhs = G2::one();

    g1_key = same_ratio_preprocess(points);
    ASSERT(same_ratio(g1_key, g2_key) == true);
}


/* Setup_SameRatioPreprocess
 *
 * 		Tests polynomial evaluation validation using
 *		generated field element and a pairing check.
 */
TEST(Setup, SameRatioPreprocess)
{
    libff::init_alt_bn128_params();

    size_t N = 3;
    std::vector<G1> points;
    points.reserve(N);

    Fr y = test_utils::DeepState_Fe<Fr>();
	LOG(TRACE) << "Testing with input value: " << y.as_bigint().as_ulong();
    Fr accumulator = y;

    for (size_t i = 0; i < 3; ++i)
    {
        points.emplace_back(accumulator * G1::one());
        accumulator = accumulator * y;
    }

    VerificationKey<G1> g1_key;
    VerificationKey<G2> g2_key;

    g2_key.lhs = y * G2::one();
    g2_key.rhs = G2::one();

    g1_key = same_ratio_preprocess(points);
    ASSERT(same_ratio(g1_key, g2_key) == true);
}


/* Setup_SameRatio1
 *
 *		Test to validate that g1_key.lhs * g2.lhs is equal to
 *		g1_key.rhs * g2_key.rhs using a generated ratio element.
 */
TEST(Setup, SameRatio1)
{
    libff::init_alt_bn128_params();

	// initialize a constant field elem with arbitrary value
    Fr x = Fr("1444073846434098342");

    Fr ratio = test_utils::DeepState_Fe<Fr>();
	LOG(TRACE) << "Testing same_ratio with input value " << ratio.as_bigint().as_ulong();

    VerificationKey<G1> g1_key;
    g1_key.lhs = x * G1::one();
    g1_key.rhs = ratio * g1_key.lhs;

    VerificationKey<G2> g2_key;
    g2_key.lhs = ratio * G2::one();
    g2_key.rhs = G2::one();

    ASSERT(same_ratio(g1_key, g2_key) == true)
        << "verification key g1 and g2 do not share same ratio";
}


/* Setup_SameRatio2
 *
 *		Test to validate that g1_key.lhs * g2.lhs is equal to
 *		g1_key.rhs * g2_key.rhs using a generated ratio element.
 */
TEST(Setup, SameRatio2)
{
    libff::init_alt_bn128_params();

    Fr x = test_utils::DeepState_Fe<Fr>();
	LOG(TRACE) << "Testing same_ratio with input value " << x.as_bigint().as_ulong();

    Fr ratio = Fr("1444073846434098342");

    VerificationKey<G1> g1_key;
    g1_key.lhs = x * G1::one();
    g1_key.rhs = ratio * g1_key.lhs;

    VerificationKey<G2> g2_key;
    g2_key.lhs = ratio * G2::one();
    g2_key.rhs = G2::one();

    ASSERT(same_ratio(g1_key, g2_key) == true)
        << "verification key g1 and g2 do not share same ratio";
}


/* Setup_BoringValidatePolynomialEvaluation
 *
 *		Validates that generated vector of points
 *		represents powering sequence based on comparator
 *		element.
 */
TEST(Setup, BoringValidatePolynomialEvaluation)
{
    constexpr size_t N = 100;

    libff::init_alt_bn128_params();

    std::vector<G1> points;
    points.reserve(N);

    Fr y = Fr::random_element();
    Fr accumulator = y;

    for (size_t i = 0; i < 100; ++i)
    {
        points.emplace_back(accumulator * G1::one());
        accumulator = accumulator * y;
    }

    G2 comparator = y * G2::one();
    ASSERT(validate_polynomial_evaluation(points, comparator) == true);
}


/* Setup_ValidatePolynomialEvaluation
 *
 *		Validates generated vectors of points
 *		represents powering sequence based on a generated
 *		comparator value.
 */
TEST(Setup, ValidatePolynomialEvaluation)
{
    constexpr size_t N = 3;

    libff::init_alt_bn128_params();

    std::vector<G1> points;
    points.reserve(N);

    Fr y = test_utils::DeepState_Fe<Fr>();
	LOG(TRACE) << "Testing with input value: " << y.as_bigint().as_ulong();
    Fr accumulator = y;

    for (size_t i = 0; i < N; ++i)
    {
        points.emplace_back(accumulator * G1::one());
        accumulator = accumulator * y;
    }

    G2 comparator = y * G2::one();
    ASSERT(validate_polynomial_evaluation(points, comparator) == true);
}


/* Setup_BoringValidateTranscript
 *
 * 		Tests that a transcript matches powering sequences for
 *		structured reference string.
 */
TEST(Setup, BoringValidateTranscript)
{
	constexpr size_t N = 100;
    constexpr size_t num_limbs = sizeof(Fq) / GMP_NUMB_BYTES;

    libff::init_alt_bn128_params();

    std::vector<G1> g1_x_prev, g1_x;
    std::vector<G2> g2_x_prev, g2_x;
    G2 g2_y;

    {
        Fr y = Fr::random_element();
        Fr accumulator = y;
        for (size_t i = 0; i < N; ++i)
        {
            g1_x_prev.emplace_back(accumulator * G1::one());
            g2_x_prev.emplace_back(accumulator * G2::one());

            accumulator = accumulator * y;
        }
    }

    {
        Fr y = Fr::random_element();
        Fr accumulator = y;
        for (size_t i = 0; i < N; ++i)
        {
            g1_x.emplace_back(accumulator * g1_x_prev[i]);
            g2_x.emplace_back(accumulator * g2_x_prev[i]);

            accumulator = accumulator * y;
        }
        g2_y = libff::fixed_window_wnaf_exp<G2, num_limbs>(5, G2::one(), y.as_bigint());
    }

    ASSERT(validate_transcript(g1_x[0], g2_x[0], g1_x, g2_x, {g1_x_prev[0]}, {g2_y}) == true)
		<< "Transcript validation failed";
}


/* Setup_ValidateTranscript
 *
 * 		Tests that a transcript matches powering sequences for
 *		structured reference string.
 */
TEST(Setup, ValidateTranscript)
{
    constexpr size_t N = 10;
    constexpr size_t num_limbs = sizeof(Fq) / GMP_NUMB_BYTES;

    libff::init_alt_bn128_params();

    std::vector<G1> g1_x_prev, g1_x;
    std::vector<G2> g2_x_prev, g2_x;
    G2 g2_y;

    {
        Fr y = test_utils::DeepState_Fe<Fr>();
		LOG(TRACE) << "Testing with input accumulator value: " << y.as_bigint().as_ulong();
        Fr accumulator = y;

        for (size_t i = 0; i < N; ++i)
        {
            g1_x_prev.emplace_back(accumulator * G1::one());
            g2_x_prev.emplace_back(accumulator * G2::one());

            accumulator = accumulator * y;
        }
    }


    {
		Fr y = test_utils::DeepState_Fe<Fr>();
		LOG(TRACE) << "Testing with input accumulator value: " << y.as_bigint().as_ulong();
        Fr accumulator = y;

		for (size_t i = 0; i < N; ++i)
		{
			g1_x.emplace_back(accumulator * g1_x_prev[i]);
			g2_x.emplace_back(accumulator * g2_x_prev[i]);

			accumulator = accumulator * y;
		}
        g2_y = libff::fixed_window_wnaf_exp<G2, num_limbs>(5, G2::one(), y.as_bigint());
    }

    ASSERT(validate_transcript(g1_x[0], g2_x[0], g1_x, g2_x, {g1_x_prev[0]}, {g2_y}) == true)
		<< "Transcript validation failed";
}
