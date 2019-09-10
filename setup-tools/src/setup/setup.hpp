/**
 * Setup
 * Copyright Spilsbury Holdings 2019
 **/
#pragma once
#include <string>

void run_setup(std::string const &dir, size_t num_g1_points, size_t num_g2_points);

#ifdef SEALING
void seal(std::string const &dir);
#endif