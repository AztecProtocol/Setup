/**
 * Setup
 * Copyright Spilsbury Holdings 2019
 * 
 **/
#include <stdio.h>
#include <thread>

#include "window.hpp"

#include <libff/algebra/scalar_multiplication/multiexp.hpp>

template <typename FieldT, typename GroupT, size_t Range, size_t Degree>
void Window<FieldT, GroupT, Range, Degree>::process_range_zero()
{
    std::vector<FieldT> range_coefficients(generator_coefficients->begin() + 1 + degree_start, generator_coefficients->begin() + degree_start + Degree +  1);
    GroupT multiexp_result = libff::multi_exp<GroupT, FieldT, libff::multi_exp_method_bos_coster>(
        powers_of_x->begin() + degree_start,
        powers_of_x->begin() + degree_start + Degree,
        range_coefficients.begin(),
        range_coefficients.end(),
        1
    );
    group_accumulators[0] = group_accumulators[0] + multiexp_result;
}

template <typename FieldT, typename GroupT, size_t Range, size_t Degree>
void Window<FieldT, GroupT, Range, Degree>::process_range_single(size_t k)
{
    std::vector<FieldT> range_coefficients(generator_coefficients->begin() + degree_start, generator_coefficients->begin() + degree_start + Degree);
    FieldT divisor = field_divisors[k];
    range_coefficients[0] -= field_accumulators[k];
    range_coefficients[0] *= divisor;

    for (size_t i = 1; i < Degree; ++i)
    {
        range_coefficients[i] -= range_coefficients[i - 1];
        range_coefficients[i] *= divisor;
        // printf("range coefficient[%d]:\n", (int)i);
        // range_coefficients[i].print();
        // printf("x[%d]:\n", (int)i);
        // powers_of_x->at(i).print();
    }

    GroupT multiexp_result = libff::multi_exp<GroupT, FieldT, libff::multi_exp_method_bos_coster>(
        powers_of_x->begin() + degree_start,
        powers_of_x->begin() + degree_start + Degree,
        range_coefficients.begin(),
        range_coefficients.end(),
        1
    );
    // multiexp_result.print();
    field_accumulators[k] = range_coefficients.back();
    group_accumulators[k] = group_accumulators[k] + multiexp_result;
}

template <typename FieldT, typename GroupT, size_t Range, size_t Degree>
void Window<FieldT, GroupT, Range, Degree>::advance_window()
{
    degree_start += Degree;
}

// TODO: eww! disgusting! fix this
template <typename FieldT, typename GroupT, size_t Range, size_t Degree>
void process_range(Window<FieldT, GroupT, Range, Degree>* window, size_t start, size_t num_ranges)
{
    for (size_t i = start; i < start + num_ranges; ++i)
    {
        if ((i % 100) == 0)
        {
            printf("processing range %d\n", (int)(window->range_start + i));
        }
        if ((window->range_start + i) == 0)
        {
            window->process_range_zero();
        }
        else
        {
            window->process_range_single(window->range_start + i);
        }
    }
}

template <typename FieldT, typename GroupT, size_t Range, size_t Degree>
void Window<FieldT, GroupT, Range, Degree>::process()
{
    size_t num_threads = (size_t)std::thread::hardware_concurrency();
    if (num_threads == 0)
    {
        // um, make a guess?
        printf("INFO: could not profile target CPU, defaulting to 4 threads\n");
        num_threads = 4;
    }

    size_t range_per_thread = Range / num_threads;
    std::vector<std::thread> threads;
    for (uint i = 0; i < num_threads; i++) {
        size_t thread_range_start = range_start + (i * range_per_thread);
        threads.push_back(std::thread(process_range<FieldT, GroupT, Range, Degree>, this, thread_range_start, range_per_thread));
    }
    for (uint i = 0; i < num_threads; i++) {
        threads[i].join();
    }
}
