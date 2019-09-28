#include <aztec_common/streaming.hpp>
#include <aztec_common/streaming_transcript.hpp>
#include <aztec_common/streaming_g1.hpp>
#include <aztec_common/streaming_g2.hpp>
#include "test_utils.hpp"

#include <libfqfft/polynomial_arithmetic/basis_change.hpp>

#include <deepstate/DeepState.hpp>

using namespace deepstate;


/* AztecCommon_BoringVariableSizeTests
 *
 * 		Concrete test for checking the size of various field elements.
 */
TEST(AztecCommon, BoringVariableSizeTests)
{
    libff::init_alt_bn128_params();
    size_t fq_bytes = sizeof(Fq);
    size_t fr_bytes = sizeof(Fr);
    size_t g1_bytes = sizeof(G1);
    size_t g2_bytes = sizeof(G2);

    ASSERT_EQ(fq_bytes, 32);
    ASSERT_EQ(fr_bytes, 32);
    ASSERT_EQ(g1_bytes, 96);
    ASSERT_EQ(g2_bytes, 192);
}


/* Streaming_BoringWriteBigIntToBuffer
 *
 * 		Concrete test that checks and verifies concrete
 *		bignum values and their resultant endianness.
 */
TEST(Streaming, BoringWriteBigIntToBuffer)
{
    libff::bigint<4> input;

	// generate bigints with concrete ulong vectors
    input.data[3] = (mp_limb_t)0xffeeddccbbaa9988UL;
    input.data[2] = (mp_limb_t)0x7766554433221100UL;
    input.data[1] = (mp_limb_t)0xf0e1d2c3b4a59687UL;
    input.data[0] = (mp_limb_t)0x78695a4b3c2d1e0fUL;

	// write bigints to buffer
    char buffer[sizeof(mp_limb_t) * 4];
    streaming::write_bigint_to_buffer<4>(input, &buffer[0]);

	// cast buffer to libgmp bignum types.
    mp_limb_t expected[4];
    expected[0] = *(mp_limb_t *)(&buffer[0]);
    expected[1] = *(mp_limb_t *)(&buffer[8]);
    expected[2] = *(mp_limb_t *)(&buffer[16]);
    expected[3] = *(mp_limb_t *)(&buffer[24]);

	// compare output with original inputs with flipped endianess
    ASSERT_EQ(expected[3], (mp_limb_t)0x8899aabbccddeeffUL);
    ASSERT_EQ(expected[2], (mp_limb_t)0x0011223344556677UL);
    ASSERT_EQ(expected[1], (mp_limb_t)0x8796a5b4c3d2e1f0UL);
    ASSERT_EQ(expected[0], (mp_limb_t)0x0f1e2d3c4b5a6978UL);
}


/* Streaming_WriteBigIntToBuffer
 *
 * 		Tests arbitrary input as bignum values and checks
 * 		for resultant endianness when reconverted to a libgmp bignum.
 */
TEST(Streaming, WriteBigIntToBuffer)
{
	libff::bigint<1> input;
	mp_limb_t expected[1];

	// generate input value casted to unsigned long
	unsigned long bigint_in = (unsigned long) DeepState_UInt64();
	input.data[0] = (mp_limb_t) bigint_in;
	LOG(TRACE) << "Unsigned long input: " << bigint_in;
	ASSERT_EQ(input.as_ulong(), bigint_in)
		<< input.as_ulong() << " does not equal input " << bigint_in;

	// write bigint to buffer, store in libgmp output
	char buffer[sizeof(mp_limb_t)];
	streaming::write_bigint_to_buffer<1>(input, &buffer[0]);
	expected[0] = *(mp_limb_t *)(&buffer[0]);

	// compare ulong input with libgmp output, with swapped endianess
	ASSERT_EQ(input.as_ulong(), __builtin_bswap64(expected[0]))
		<< input.as_ulong() << " does not equal " << __builtin_bswap64(expected[0]);
}


/* Streaming_ReadG1ElemsToBuffer
 *
 * 		Tests reading arbitrary buffer input to G1 elements
 *		and then comparing to newly written output buffer.
 */
TEST(Streaming, ReadG1ElemsToBuffer)
{
	constexpr size_t N = 10;
	constexpr size_t element_size = sizeof(Fq) * 2;
	constexpr size_t buffer_size = N * element_size;

	libff::init_alt_bn128_params();

	std::vector<G1> result;
	std::vector<G1> elems;
	result.reserve(N);
	elems.reserve(N);

	// buffers for reading/writing G1 elements
	char out_buffer[buffer_size];
	char * buffer = DeepState_CStrUpToLen(buffer_size);
	LOG(TRACE) << "Input buffer :" << buffer <<
		" of size: " << buffer_size;

	// read from elements out of buffer
	streaming::read_g1_elements_from_buffer(elems, buffer, element_size);
	for (size_t i = 0; i < N; i++)
	{
		elems[i].to_affine_coordinates();
		result.emplace_back(elems[i]);
	}
	streaming::write_g1_elements_to_buffer(result, out_buffer);

	ASSERT(memcmp(buffer, out_buffer, buffer_size))
		<< "Input buffer: " << buffer << " is not equal to output buffer: " << out_buffer;
}


/* Streaming_BoringReadG1ElemsFromBufferFile
 *
 * 		Concrete test vector for testing reading empty
 *		transcript file to G1 element, writing to output buffer
 *		and comparing
TEST(Streaming, DISABLED_BoringReadG1ElemsFromBufferFile)
{
	// transcript file to tests should actually exist
	std::string transcript_path("./transcript/transcript00.dat");
	if (!streaming::is_file_exist(transcript_path)) {
		LOG(ERROR) << "Transcript path: " << transcript_path << " should be \
		manually initialized with empty transcript file";
	}

	constexpr size_t buffer_size = sizeof(Fq) * 2;

	libff::init_alt_bn128_params();

	std::vector<G1> result;
	std::vector<G1> elems;

	char buffer[buffer_size];
	char out_buffer[buffer_size];

	// read to std::vec<char>, convert to char * buffer with std::copy
	auto _buffer = streaming::read_file_into_buffer(transcript_path);
	LOG(TRACE) << "Input buffer size: " << _buffer.size();
	LOG(TRACE) << "Expected buffer size: " << buffer_size;

	std::copy(_buffer.begin(), _buffer.end(), buffer);

	// read contents from file to G1 element
	streaming::read_g1_elements_from_buffer(elems, buffer, buffer_size);
	elems[0].to_affine_coordinates();
	result.emplace_back(elems[0]);

	// write back to output buffer and compare
	streaming::write_g1_elements_to_buffer(result, out_buffer);
	ASSERT(memcmp(buffer, out_buffer, buffer_size))
		<< "out_buffer contents: " << out_buffer;
}
 */

/* Streaming_BoringWriteG1ElemsToBuffer
 *
 * 		Concrete test vector for writing random G1 elements to
 *		a buffer, reading and then validating them.
 */
TEST(Streaming, BoringWriteG1ElemsToBuffer)
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


/* Streaming_WriteG1ElemToBuffer
 *
 * 		Tests writing a single generated G1 element to a buffer,
 *		and then reading and validating it.
 */
TEST(Streaming, WriteG1ElemToBuffer)
{
    constexpr size_t N = 1;
    constexpr size_t element_size = sizeof(Fq) * 2;
    constexpr size_t buffer_size = N * element_size;
    constexpr size_t num_limbs = sizeof(Fq) / GMP_NUMB_BYTES;

    libff::init_alt_bn128_params();

    std::vector<G1> result;
    std::vector<G1> expected;
    result.reserve(N);
    expected.reserve(N);

    char buffer[buffer_size];

	// generate Jacobian coordinates for G1 element
	G1 point = test_utils::DeepState_G1();
	point.to_affine_coordinates();
	expected.emplace_back(point);

    streaming::write_g1_elements_to_buffer(expected, buffer);
    streaming::read_g1_elements_from_buffer(result, buffer, buffer_size);

	test_utils::validate_g1_point<num_limbs>(result[0], expected[0]);
}


/* Streaming_BoringReadG2ElemsFromBufferFile
 *
 * 		Concrete test vector for testing reading empty
 *		transcript file to G2 element, writing to output buffer
 *		and comparing.
TEST(Streaming, DISABLED_BoringReadG2ElemsFromBufferFile)
{
	// transcript file to tests hould actually exist
	std::string transcript_path("./transcript/transcript00.dat");
	if (!streaming::is_file_exist(transcript_path)) {
		LOG(ERROR) << "Transcript path: " << transcript_path << " should be \
		manually initialized with empty transcript file";
	}

	constexpr size_t buffer_size = sizeof(Fqe) * 2;

	libff::init_alt_bn128_params();

	std::vector<G2> result;
	std::vector<G2> elems;

	char buffer[buffer_size];
	char out_buffer[buffer_size];

	// read to std::vec<char>, convert to char * buffer with std::copy
	auto _buffer = streaming::read_file_into_buffer(transcript_path);
	LOG(TRACE) << "Input buffer size: " << _buffer.size();
	LOG(TRACE) << "Expected buffer size: " << buffer_size;

	std::copy(_buffer.begin(), _buffer.end(), buffer);

	// read contents from file to G1 element
	streaming::read_g2_elements_from_buffer(elems, buffer, buffer_size);
	elems[0].to_affine_coordinates();
	result.emplace_back(elems[0]);

	// write back to output buffer and compare
	streaming::write_g2_elements_to_buffer(result, out_buffer);
	ASSERT(memcmp(buffer, out_buffer, buffer_size))
		<< "out_buffer contents: " << out_buffer;
}
*/


/* Streaming_ReadG2ElemsToBuffer
 *
 * 		Tests reading arbitrary buffer input to G2 elements
 *		and then comparing to newly written output buffer.
 */
TEST(Streaming, ReadG2ElemsToBuffer)
{
	constexpr size_t N = 10;
	constexpr size_t element_size = sizeof(Fqe) * 2;
	constexpr size_t buffer_size = N * element_size;

	libff::init_alt_bn128_params();

	std::vector<G2> result;
	std::vector<G2> elems;
	result.reserve(N);
	elems.reserve(N);

	// buffers for reading/writing G2 elements
	char out_buffer[buffer_size];
	char * buffer = DeepState_CStr(buffer_size);
	LOG(TRACE) << "Input buffer: " << buffer;

	// read from elements out of buffer
	streaming::read_g2_elements_from_buffer(elems, buffer, element_size);
	for (size_t i = 0; i < N; i++)
	{
		elems[i].to_affine_coordinates();
		result.emplace_back(elems[i]);
	}
	streaming::write_g2_elements_to_buffer(result, out_buffer);

	ASSERT(memcmp(buffer, out_buffer, buffer_size))
		<< "Input buffer " << buffer << " is not equal to output buffer " << out_buffer;
}


/* Streaming_BoringWriteG2ElemsToBuffer
 *
 * 		Concrete test vector for writing random G2 elements to
 *		a buffer, reading and then validating them.
 */
TEST(Streaming, BoringWriteG2ElemsToBuffer)
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


/* Streaming_WriteG2ElemToBuffer
 *
 * 		Tests writing a single generated G2 element to a buffer,
 *		and then reading and validating it.
 */
TEST(Streaming, WriteG2ElemToBuffer)
{
    constexpr size_t N = 1;
    constexpr size_t element_size = sizeof(Fqe) * 2;
    constexpr size_t buffer_size = N * element_size;
    constexpr size_t num_limbs = sizeof(Fq) / GMP_NUMB_BYTES;

    libff::init_alt_bn128_params();

    std::vector<G2> result;
    std::vector<G2> expected;
    result.reserve(N);
    expected.reserve(N);

    char buffer[buffer_size];

	// generate Jacobian coordinates for G2 element
	G2 point = test_utils::DeepState_G2();
	point.to_affine_coordinates();
	expected.emplace_back(point);

    streaming::write_g2_elements_to_buffer(expected, buffer);
    streaming::read_g2_elements_from_buffer(result, buffer, buffer_size);

	test_utils::validate_g2_point<num_limbs>(result[0], expected[0]);
}


/* Streaming_BoringReadWriteTranscripts
 *
 * 		Concrete test for generating random element points,
 *		writing and reading them to temporary transcript files,
 *		and validating the points.
 */
TEST(Streaming, BoringReadWriteTranscripts)
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


/* Streaming_ReadWriteTranscripts
 *
 * 		Test for generating arbitrary element points,
 *		writing and reading them to temporary transcript files,
 *		and validating the points.
 */
TEST(Streaming, ReadWriteTranscripts)
{
    constexpr size_t G1_N = 10;
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
        G1 g1_point = test_utils::DeepState_G1();
        g1_point.to_affine_coordinates();
        g1_expected.emplace_back(g1_point);
    }

    for (size_t i = 0; i < G2_N; ++i)
    {
        G2 g2_point = test_utils::DeepState_G2();
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


/* Streaming_WriteReadFieldElementsFile
 *
 * 		Test for generating for comparing original and resultant field
 *		elements after writing and reading from temporary file.
 */
TEST(Streaming, WriteReadFieldElementsFile)
{
	libff::alt_bn128_pp::init_public_params();

	std::vector<Fr> original;
	std::vector<Fr> result;

	//Fr point = (Fr) DeepState_UInt64();
	Fr point = test_utils::DeepState_Fe<Fr>();
	original.emplace_back(point);

	// write and read from temporary file back to field elem vector
	streaming::write_field_elements_to_file(original, "/tmp/fe_test");
	streaming::read_field_elements_from_file(result, "/tmp/fe_test", 1);

	// read will add extra elem to result, so do check of first elem
	ASSERT_EQ(original.size() + 1, result.size())
		<< "original vec size + 1 not equivalent to size of result";
	ASSERT(original[0] == result[0])
		<< "Resultant field elem not equal to original field elem";
}


/* Streaming_ReadTranscriptG1Points
 *
 * 		Test for generating and validating G1 elements that
 *		written and read from a temporary transcript.
 */
TEST(Streaming, ReadTranscriptG1Points)
{
	constexpr size_t G1_N = 1;
	constexpr size_t num_limbs = sizeof(Fq) / GMP_NUMB_BYTES;

	libff::alt_bn128_pp::init_public_params();

	std::vector<G1> g1_x;
	std::vector<G1> g1_out;
	std::vector<G2> g2_x = {};

	// generate initial transcript manifest
	streaming::Manifest manifest;
	manifest.transcript_number = 0;
	manifest.total_transcripts = 1;
	manifest.total_g1_points = G1_N;
	manifest.total_g2_points = 0;
	manifest.num_g1_points = G1_N;
	manifest.num_g2_points = 0;
	manifest.start_from = 0;

	for (size_t i = 0; i < G1_N; ++i)
	{
		G1 g1_point = test_utils::DeepState_G1();
		g1_point.to_affine_coordinates();
		g1_x.emplace_back(g1_point);
	}

	streaming::write_transcript(g1_x, g2_x, manifest, "/tmp/g1_test");
	streaming::read_transcript_g1_points(g1_out, "/tmp/g1_test", 0, G1_N);

	for (size_t i = 0; i < G1_N; ++i)
	{
		test_utils::validate_g1_point<num_limbs>(g1_x[i], g1_out[i]);
	}
}


/* Streaming_ReadTranscriptG2Points
 *
 * 		Test for generating and validating G2 elements that
 *		written and read from a temporary transcript.
 */
TEST(Streaming, ReadTranscriptG2Points)
{
	constexpr size_t G2_N = 1;
	constexpr size_t num_limbs = sizeof(Fq) / GMP_NUMB_BYTES;

	libff::alt_bn128_pp::init_public_params();

	std::vector<G1> g1_x = {};
	std::vector<G2> g2_x;
	std::vector<G2> g2_out;

	// generate initial transcript manifest
	streaming::Manifest manifest;
	manifest.transcript_number = 0;
	manifest.total_transcripts = 1;
	manifest.total_g1_points = 0;
	manifest.total_g2_points = G2_N;
	manifest.num_g1_points = 0;
	manifest.num_g2_points = G2_N;
	manifest.start_from = 0;

	for (size_t i = 0; i < G2_N; ++i)
	{
		G2 g2_point = test_utils::DeepState_G2();
		g2_point.to_affine_coordinates();
		g2_x.emplace_back(g2_point);
	}

	streaming::write_transcript(g1_x, g2_x, manifest, "/tmp/g2_test");
	streaming::read_transcript_g2_points(g2_out, "/tmp/g2_test", 0, G2_N);

	for (size_t i = 0; i < G2_N; ++i)
	{
		test_utils::validate_g2_point<num_limbs>(g2_x[i], g2_out[i]);
	}
}
