/**
 * Setup
 * Copyright Spilsbury Holdings 2019
 *
 **/
#pragma once

namespace generator
{
template <typename FieldT, size_t M>
void compute_generator_polynomial(const size_t kmax);
}
#include "compute_generator_polynomial.tcc"