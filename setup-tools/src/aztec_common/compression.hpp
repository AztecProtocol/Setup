/**
 * Setup
 * Copyright Spilsbury Holdings 2019
 **/
#pragma once
#include <gmp.h>
#include <libff/algebra/fields/bigint.hpp>
#include "assert.hpp"

namespace compression
{

template <size_t N, typename FieldT, typename GroupT>
GroupT decompress(libff::bigint<N> &x)
{
    // get most significant limb of x
    mp_limb_t last = x.data[N - 1];
    // convert msb to boolean value
    bool set = last >> (GMP_NUMB_BITS - 1);

    // create a mask where most significant bit of (mp_limb_t) is low, others high
    mp_limb_t mask = ~(mp_limb_t(1) << (GMP_NUMB_BITS - 1));

    // remove y-bit from x
    x.data[N - 1] = x.data[N - 1] & mask;

    // convert x into a field element
    FieldT fq_x = FieldT(x);
    // compute y from x
    // TODO: Generalize to more than bn128
    FieldT fq_y2 = (fq_x.squared() * fq_x) + 3;
    FieldT fq_y = fq_y2.sqrt();
    // (check this is a valid solution)
    ASSERT(fq_y.squared() == fq_y2);
    // invert y if sign of root does not match
    bool is_odd = fq_y.as_bigint().test_bit(0);
    fq_y = (is_odd != set) ? -fq_y : fq_y;
    return GroupT(fq_x, fq_y, FieldT::one());
}

}; // namespace compression