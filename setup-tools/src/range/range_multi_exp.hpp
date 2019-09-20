/**
 * Setup
 * Copyright Spilsbury Holdings 2019
 **/
#pragma once

#include <aztec_common/libff_types.hpp>

G1 process_range(int range_index, Fr &fa, G1 *const powers_of_x, Fr *const generator_coefficients, size_t start, size_t num);

void compute_range_polynomials(int range_index, size_t polynomial_degree);