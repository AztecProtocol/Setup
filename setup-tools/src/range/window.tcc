/**
 * Setup
 * Copyright Spilsbury Holdings 2019
 *
 **/
#include <stdio.h>
#include <thread>

#include "window.hpp"

#include <libff/algebra/scalar_multiplication/multiexp.hpp>

template <typename FieldT, typename GroupT, size_t Range>
void Window<FieldT, GroupT, Range>::process_range_zero()
{
    printf("%zu %zu", degree_start, degree);
    std::vector<FieldT>
        range_coefficients(generator_coefficients->begin() + 1 + degree_start, generator_coefficients->begin() + degree_start + degree + 1);
    GroupT multiexp_result = libff::multi_exp<GroupT, FieldT, libff::multi_exp_method_bos_coster>(
        powers_of_x->begin() + degree_start,
        powers_of_x->begin() + degree_start + degree,
        range_coefficients.begin(),
        range_coefficients.end(),
        1);
    group_accumulators[0] = group_accumulators[0] + multiexp_result;
}

template <typename FieldT, typename GroupT, size_t Range>
void Window<FieldT, GroupT, Range>::process_range_single(size_t k)
{
    // printf("processing single range\n");
    std::vector<FieldT> range_coefficients(generator_coefficients->begin() + degree_start, generator_coefficients->begin() + degree_start + degree);
    FieldT divisor = field_divisors[k];
    range_coefficients[0] -= field_accumulators[k];
    range_coefficients[0] *= divisor;

    for (size_t i = 1; i < degree; ++i)
    {
        range_coefficients[i] -= range_coefficients[i - 1];
        range_coefficients[i] *= divisor;
    }

    GroupT multiexp_result = libff::multi_exp<GroupT, FieldT, libff::multi_exp_method_bos_coster>(
        powers_of_x->begin() + degree_start,
        powers_of_x->begin() + degree_start + degree,
        range_coefficients.begin(),
        range_coefficients.end(),
        1);

    // multiexp_result.print();
    field_accumulators[k] = range_coefficients.back();
    group_accumulators[k] = group_accumulators[k] + multiexp_result;
    // printf("processed single range\n");
}

template <typename FieldT, typename GroupT, size_t Range>
void Window<FieldT, GroupT, Range>::advance_window()
{
    degree_start += degree;
}

template <typename FieldT, typename GroupT, size_t Range>
void process_range(Window<FieldT, GroupT, Range> *window, size_t start, size_t num_ranges)
{
    printf("in process range. start = %lu, end = %lu\n", start, start + num_ranges);
    for (size_t i = start; i < start + num_ranges; ++i)
    {
        if ((i % 100) == 0)
        {
            // printf("processing range %d\n", (int)(window->range_start + i));
        }
        if ((window->range_start + i) == 0)
        {
            window->process_range_zero();
        }
        else
        {
            window->process_range_single(i);
        }
    }
    // printf("exiting process range\n");
}

template <typename FieldT, typename GroupT, size_t Range>
void Window<FieldT, GroupT, Range>::process()
{
    size_t num_threads = (size_t)std::thread::hardware_concurrency();
    if (num_threads == 0)
    {
        // um, make a guess?
        // printf("INFO: could not profile target CPU, defaulting to 4 threads\n");
        num_threads = 4;
    }

    size_t range_per_thread = Range / num_threads;
    if (num_threads >= range_per_thread)
    {
        num_threads = Range;
        range_per_thread = 1;
    }
    printf("num_threads = %lu\n", num_threads);
    std::vector<std::thread> threads;
    for (uint i = 0; i < num_threads; i++)
    {
        // n.b. if this window's range does not start at 0, this is represented by having different field_divisors in the Window constructor
        size_t thread_range_start = (i * range_per_thread);
        // printf("thread range start = %lu \n", thread_range_start);
        threads.push_back(std::thread(process_range<FieldT, GroupT, Range>, this, thread_range_start, range_per_thread));
    }
    // printf("waiting to join %lu threads\n", num_threads);
    for (uint i = 0; i < num_threads; i++)
    {
        threads[i].join();
    }
    // printf("exiting window.process\n");
}
