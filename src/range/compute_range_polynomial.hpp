#pragma once

#include <stdlib.h>
#include <vector>

namespace range
{
template <typename FieldT, size_t M>
void compute_range_polynomial(FieldT* generator_polynomial, FieldT* range_polynomial, size_t range_integer);

template <typename FieldT, size_t M>
void compute_range_polynomials(size_t index, size_t range);
} // namespace range
#include "compute_range_polynomial.tcc"
