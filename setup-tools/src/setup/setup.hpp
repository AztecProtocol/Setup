/**
 * Setup
 * Copyright Spilsbury Holdings 2019
 **/
#pragma once
#include <string>
#include <atomic>
#include <aztec_common/libff_types.hpp>

void compute_g1_thread(Fr const &_y, std::vector<G1> &g_x, size_t transcript_start, size_t thread_start, size_t thread_range, std::atomic<size_t> &progress);

void run_setup(std::string const &dir, size_t num_g1_points, size_t num_g2_points);

#ifdef SEALING
void seal(std::string const &dir);
#endif