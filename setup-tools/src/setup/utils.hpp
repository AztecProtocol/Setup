/**
 * Setup
 * Copyright Spilsbury Holdings 2019
 *
 **/
#pragma once

#include <stddef.h>
#include <aztec_common/libff_types.hpp>

namespace utils
{

inline bool isLittleEndian()
{
    int num = 42;
    return (*(char *)&num == 42);
}

template <typename FieldT, typename GroupT>
void batch_normalize(size_t start, size_t number, GroupT *x, GroupT *alpha_x)
{
    FieldT accumulator = FieldT::one();
    FieldT *temporaries = static_cast<FieldT *>(malloc(2 * number * sizeof(FieldT)));
    for (size_t i = 0; i < number; ++i)
    {
        temporaries[2 * i] = accumulator;
        accumulator = accumulator * x[i + start].Z;
        temporaries[2 * i + 1] = accumulator;
        accumulator = accumulator * alpha_x[i + start].Z;
    }
    accumulator = accumulator.inverse();

    FieldT zzInv;
    FieldT zInv;
    for (size_t i = number - 1; i < (size_t)(-1); --i)
    {
        zInv = accumulator * temporaries[2 * i + 1];
        zzInv = zInv * zInv;
        alpha_x[i + start].X = alpha_x[i + start].X * zzInv;
        alpha_x[i + start].Y = alpha_x[i + start].Y * (zzInv * zInv);
        accumulator = accumulator * alpha_x[i + start].Z; // temporaries[2 * i + 1];
        alpha_x[i + start].Z = FieldT::one();
        zInv = accumulator * temporaries[2 * i];
        zzInv = zInv * zInv;
        x[i + start].X = x[i + start].X * zzInv;
        x[i + start].Y = x[i + start].Y * (zzInv * zInv);
        accumulator = accumulator * x[i + start].Z; // temporaries[2 * i + 1];
        x[i + start].Z = FieldT::one();
    }
    free(temporaries);
}

template <typename FieldT, typename GroupT>
void batch_normalize(size_t start, size_t number, GroupT *x)
{
    FieldT accumulator = FieldT::one();
    FieldT *temporaries = static_cast<FieldT *>(malloc(number * sizeof(FieldT)));
    for (size_t i = 0; i < number; ++i)
    {
        temporaries[i] = accumulator;
        accumulator = accumulator * x[i + start].Z;
    }
    accumulator = accumulator.inverse();

    FieldT zzInv;
    FieldT zInv;
    for (size_t i = number - 1; i < (size_t)(-1); --i)
    {
        zInv = accumulator * temporaries[i];
        zzInv = zInv * zInv;
        x[i + start].X = x[i + start].X * zzInv;
        x[i + start].Y = x[i + start].Y * (zzInv * zInv);
        accumulator = accumulator * x[i + start].Z; // temporaries[2 * i + 1];
        x[i + start].Z = FieldT::one();
    }
    free(temporaries);
}

template <typename FieldT>
FieldT convert_buffer_to_field_element(char *buffer, size_t size)
{
    if (size < sizeof(FieldT))
    {
        // throw an error if the buffer size is too small.
        // Don't want to just zero-pad, it is likely that something has gone wrong - with our current use-case,
        // buffer should be from a PRNG, which won't translate into a uniformly randomly distributed element Fp
        // if the buffer is too small
        throw std::runtime_error("cannot convert buffer to field element: buffer too small");
    }
    constexpr size_t num_limbs = sizeof(FieldT) / GMP_NUMB_BYTES;

    FieldT element;
    auto element_bigint = element.as_bigint();
    mp_limb_t *element_ptr = (mp_limb_t *)buffer;
    for (size_t j = 0; j < num_limbs; ++j)
    {
        mp_limb_t limb = element_ptr[j];
        if (isLittleEndian())
        {
            limb = __builtin_bswap64(limb);
        }
        element_bigint.data[j] = limb;
    }
    element = FieldT(element_bigint);
    return element;
}
} // namespace utils