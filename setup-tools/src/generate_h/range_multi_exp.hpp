/**
 * Setup
 * Copyright Spilsbury Holdings 2019
 **/
#pragma once

#include <aztec_common/libff_types.hpp>

namespace generate_h
{

G1 process_range(std::vector<G1> const &powers_of_x, std::vector<Fr> const &generator_coefficients, size_t start, size_t num);

void compute_h(std::string const &setup_db_path, std::string const &generator_path);

} // namespace generate_h