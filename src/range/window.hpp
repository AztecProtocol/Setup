/**
 * Setup
 * Copyright Spilsbury Holdings 2019
 * 
 **/
#pragma once

#include "stddef.h"

template <typename FieldT, typename GroupT, size_t Range, size_t Degree>
class Window
{

public:
    Window(std::vector<GroupT> *_powers_of_x,
           std::vector<FieldT> *_generator_coefficients,
           size_t _range_start,
           size_t _degree_start) : range_start(_range_start),
                                   degree_start(_degree_start)
    {
        powers_of_x = _powers_of_x;
        generator_coefficients = _generator_coefficients;
        field_accumulators.reserve(Range);
        group_accumulators.reserve(Range);
        field_divisors.reserve(Range);
        for (size_t i = 0; i < Range; ++i)
        {
            size_t scalar = i + range_start;
            field_divisors.emplace_back((scalar == 0) ? FieldT::one() : (-FieldT(scalar)).inverse());
            group_accumulators.emplace_back(GroupT::zero());
            field_accumulators.emplace_back(FieldT::zero());
        }
    }

    void advance_window();
    void process();
    std::vector<GroupT> *get_group_accumulators() { return &group_accumulators; }
    std::vector<FieldT> *get_field_accumulators() { return &field_accumulators; }
    void process_range_single(size_t k);
    void process_range_zero();
    size_t range_start;

private:
    // void process_range(size_t start, size_t end);

    std::vector<GroupT> *powers_of_x;
    std::vector<FieldT> *generator_coefficients;
    size_t degree_start;
    std::vector<GroupT> group_accumulators;
    std::vector<FieldT> field_accumulators;
    std::vector<FieldT> field_divisors;

    // GroupT* generator_precompute_table;
};
#include "window.tcc"