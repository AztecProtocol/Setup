#include <libff/algebra/curves/alt_bn128/alt_bn128_pp.hpp>
#include <libff/common/double.hpp>

#include <libfqfft/polynomial_arithmetic/basis_change.hpp>
#include <libfqfft/evaluation_domain/evaluation_domain.hpp>
#include <libfqfft/evaluation_domain/domains/arithmetic_sequence_domain.hpp>

#include <aztec_common/streaming_transcript.hpp>
#include <setup/setup.hpp>
#include <range/range_multi_exp.hpp>
#include <generator/compute_generator_polynomial.hpp>

#include "test_utils.hpp"

#include <deepstate/DeepState.hpp>

using namespace deepstate;


/* Range_GeneratorPolynomial
 *
 * 		Tests generating polynomial coefficients for
 *		varying degrees and comparing results when written
 *		and read as field elements from a transcript file
 */
TEST(Range, GeneratorPolynomial)
{
	size_t DEGREE = (size_t) DeepState_MinUShort(1);
	LOG(TRACE) << "Testing with polynomial degree " << DEGREE;

	libff::alt_bn128_pp::init_public_params();

	std::vector<libff::alt_bn128_Fr> res1;
	std::vector<libff::alt_bn128_Fr> res2;

	// compute generator polynomial and store coefficients
	std::vector<std::vector<std::vector<libff::alt_bn128_Fr>>> subproduct_tree;
	libfqfft::compute_subproduct_tree(log2(DEGREE), subproduct_tree);
	res1 = subproduct_tree[log2(DEGREE)][0];

	// call generator function, and read stored coefficients from transcript file
	generator::compute_generator_polynomial<libff::Fr<libff::alt_bn128_pp>>(DEGREE);
	streaming::read_field_elements_from_file(res2, "../setup_db/generator.dat", DEGREE);

	// check each indiidual element, res2 may have larger buffer size
	for (size_t i = 0; i < res1.size(); i++) {
		ASSERT(res1[i] == res2[i])
			<< "Generator polynomial coefficients not equal";
	}
}


/* Range_RangePolynomials
 *
 * 		Tests compute_range_polynomials for computing AZTEC signature
 *		points after computing a generator polynomial and a round of
 *		MPC setup.
 */
TEST(Range, RangePolynomials)
{
	constexpr size_t DEGREE = 0x10000;
	const size_t range_index = DeepState_MinInt(1);

	libff::alt_bn128_pp::init_public_params();

	// generate coeffs for generator polynomial
	generator::compute_generator_polynomial<libff::Fr<libff::alt_bn128_pp>>(DEGREE);

	// run setup to produce an initial transcript
	run_setup("../setup_db", range_index, 1);

	// produce output for memory mapping within compute_range_polynomials
	std::vector<Fr> generator_polynomial;
	std::vector<G1> g1_x(DEGREE);
	std::vector<G2> g2_x(DEGREE);
	streaming::Manifest manifest;

	streaming::read_field_elements_from_file(generator_polynomial, "../setup_db/generator.dat", DEGREE + 1);
	streaming::read_transcript(g1_x, g2_x, manifest, "../setup_db/transcript0_out.dat");
	g1_x.insert(g1_x.begin(), G1::one());

	{
	  std::ofstream file("../setup_db/generator_prep.dat");
	  file.write((char *)&generator_polynomial[0], generator_polynomial.size() * sizeof(Fr));
	}

	{
	  std::ofstream file("../setup_db/g1_x_prep.dat");
	  file.write((char *)&g1_x[0], g1_x.size() * sizeof(G1));
	}

	// calculate signature point for rangeproofs
	compute_range_polynomials<libff::alt_bn128_pp>(range_index, DEGREE);
}


TEST(Range, Window)
{
    constexpr size_t DEGREE = 0x100;

	libff::init_alt_bn128_params();

	// initialize generator polynomial
    std::vector<std::vector<std::vector<libff::alt_bn128_Fr>>> subproduct_tree;
    libfqfft::compute_subproduct_tree(log2(DEGREE), subproduct_tree);
	std::vector<libff::alt_bn128_Fr> generator_polynomial = subproduct_tree[log2(DEGREE)][0];

    libff::alt_bn128_Fr x = test_utils::DeepState_Fe<Fr>();
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

    libff::alt_bn128_G1 h = libff::alt_bn128_G1::zero();
    for (size_t i = 0; i < generator_polynomial.size(); ++i)
    {
        libff::alt_bn128_G1 pt = generator_polynomial[i] * g1_x[i];
        h = h + pt;
    }

    for (size_t i = 0; i < DEGREE; ++i)
    {
        libff::alt_bn128_Fr fa;
        libff::alt_bn128_G1 process_result = process_range(i, fa, &g1_x[0], &generator_polynomial[0], 0, DEGREE);
        libff::alt_bn128_G1 t0 = x * process_result;
        libff::alt_bn128_G1 t1 = (-libff::alt_bn128_Fr(i)) * process_result;
        libff::alt_bn128_G1 result = t0 + t1;
        result.to_affine_coordinates();
        h.to_affine_coordinates();
        test_utils::validate_g1_point<4>(result, h);
    }
}
