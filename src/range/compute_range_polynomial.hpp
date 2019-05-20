/**
 * Setup
 * Copyright Spilsbury Holdings 2019
 * 
 **/
#pragma once

#include <stdlib.h>
#include <vector>

namespace range
{
constexpr size_t POLYNOMIAL_DEGREE = 10000;
constexpr size_t POLYNOMIAL_RANGE = 10000;
constexpr size_t RANGES_PER_SLICE = 1000;
constexpr size_t DEGREES_PER_SLICE = 1000;
template <typename FieldT, size_t M>
void compute_range_polynomial(FieldT* generator_polynomial, FieldT* range_polynomial, size_t range_integer);

template <typename ppT>
void compute_range_polynomials(size_t index, size_t range);
} // namespace range
#include "compute_range_polynomial.tcc"
