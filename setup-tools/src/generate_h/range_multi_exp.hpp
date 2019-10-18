/**
 * Setup
 * Copyright Spilsbury Holdings 2019
 **/
#pragma once

#include <string>
#include <barretenberg/fields/fr.hpp>
#include <barretenberg/groups/g1.hpp>

namespace bb = barretenberg;

namespace generate_h
{

bb::g1::element process_range(bb::g1::affine_element *const &powers_of_x, bb::fr::field_t *const &generator_coefficients, size_t start, size_t num);

bb::g1::element batch_process_range(size_t polynomial_degree, size_t batch_num, bb::g1::affine_element *const &g1_x, bb::fr::field_t *const &generator_polynomial);

void compute_h(std::string const &generator_path, std::string const& g1x_path, size_t polynomial_degree, size_t batches);

} // namespace generate_h