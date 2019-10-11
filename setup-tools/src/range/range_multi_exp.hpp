/**
 * Setup
 * Copyright Spilsbury Holdings 2019
 **/
#pragma once

#include <aztec_common/libff_types.hpp>

G1 process_range(int range_index, Fr &fa, G1 *const powers_of_x, Fr *const generator_coefficients, size_t start, size_t num);

G1 batch_process_range(size_t range_index, size_t polynomial_degree, size_t batch_num, G1 *const &g1_x, Fr *const &generator_polynomial);

void compute_range_polynomials(std::string const &setup_db_path, size_t range_index, size_t polynomial_degree, size_t batches);