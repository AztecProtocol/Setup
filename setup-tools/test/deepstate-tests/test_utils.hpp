#pragma once

#include "stddef.h"

#include <libff/algebra/curves/alt_bn128/alt_bn128_g1.hpp>
#include <libff/algebra/curves/alt_bn128/alt_bn128_g2.hpp>

#include <deepstate/DeepState.hpp>

using namespace deepstate;
using Fq2 = libff::alt_bn128_Fq2;

namespace test_utils
{


/* re-implementation of convert_buffer_to_field_element but with DeepState input generation */
template <typename FieldT>
DEEPSTATE_INLINE FieldT DeepState_Fe(void)
{
	constexpr size_t bytes_per_element = sizeof(FieldT);
	constexpr size_t num_limbs = bytes_per_element / GMP_NUMB_BYTES;

	uint8_t * _buffer = (uint8_t *) DeepState_CStr(bytes_per_element);
	std::vector<uint8_t> buffer(_buffer, _buffer + sizeof(_buffer));

	FieldT element;
	auto element_bigint = element.as_bigint();
	for (size_t i = 0; i < sizeof(buffer); i += bytes_per_element)
	{
		mp_limb_t *element_ptr = (mp_limb_t *)((char *)(&*buffer.begin()) + 1);
		for (size_t j = 0; j < num_limbs; ++j)
		{
			mp_limb_t limb = element_ptr[j];
			if (streaming::isLittleEndian())
			{
				limb = __builtin_bswap64(limb);
			}
			element_bigint.data[j] = limb;
		}
	}
	return FieldT(element_bigint);
}


/* helper for generating G1 element with Jacobian coordinates */
DEEPSTATE_INLINE G1 DeepState_G1(void)
{
	Fq x = DeepState_Fe<Fq>();
	Fq y = DeepState_Fe<Fq>();
	Fq z = DeepState_Fe<Fq>();
	return G1(x, y, z);
}


/* helper for generating G2 element with Jacobian coordinates */
DEEPSTATE_INLINE G2 DeepState_G2(void)
{
	Fq2 x = Fq2(DeepState_Fe<Fq>(), DeepState_Fe<Fq>());
	Fq2 y = Fq2(DeepState_Fe<Fq>(), DeepState_Fe<Fq>());
	Fq2 z = Fq2(DeepState_Fe<Fq>(), DeepState_Fe<Fq>());
	return G2(x, y, z);
}


template <size_t N>
void validate_g1_point(libff::alt_bn128_G1 &result, libff::alt_bn128_G1 &expected)
{
    libff::bigint<N> result_x = result.X.as_bigint();
    libff::bigint<N> result_y = result.Y.as_bigint();
    libff::bigint<N> expected_x = expected.X.as_bigint();
    libff::bigint<N> expected_y = expected.Y.as_bigint();

    for (size_t i = 0; i < N; ++i)
    {
        ASSERT_EQ(result_x.data[i], expected_x.data[i]);
        ASSERT_EQ(result_y.data[i], expected_y.data[i]);
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
        ASSERT_EQ(result_x0.data[i], expected_x0.data[i]);
        ASSERT_EQ(result_y0.data[i], expected_y0.data[i]);
        ASSERT_EQ(result_x1.data[i], expected_x1.data[i]);
        ASSERT_EQ(result_y1.data[i], expected_y1.data[i]);
    }
}
} // namespace utils
