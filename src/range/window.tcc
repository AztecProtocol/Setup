#include <stdio.h>

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
void Window<FieldT, GroupT, Range, Degree>::process_range(size_t k)
{
    std::vector<FieldT> range_coefficients(generator_coefficients->begin() + degree_start, generator_coefficients->begin() + degree_start + Degree);
    FieldT divisor = field_divisors[k];
    range_coefficients[0] -= field_accumulators[k];
    range_coefficients[0] *= divisor;

    for (size_t i = 1; i < Degree; ++i)
    {
        range_coefficients[i] -= range_coefficients[i - 1];
        range_coefficients[i] *= divisor;
    }

    GroupT multiexp_result = libff::multi_exp<GroupT, FieldT, libff::multi_exp_method_bos_coster>(
        powers_of_x->begin() + degree_start,
        powers_of_x->begin() + degree_start + Degree,
        range_coefficients.begin(),
        range_coefficients.end(),
        1
    );

    field_accumulators[k] = range_coefficients.back();
    group_accumulators[k] = group_accumulators[k] + multiexp_result;
}

template <typename FieldT, typename GroupT, size_t Range, size_t Degree>
void Window<FieldT, GroupT, Range, Degree>::advance_window()
{
    degree_start += Degree;
}

template <typename FieldT, typename GroupT, size_t Range, size_t Degree>
void Window<FieldT, GroupT, Range, Degree>::process()
{
    // TODO: mulithread this part
    for (size_t i = 0; i < Range; ++i)
    {
        if ((i % 100) == 0)
        {
            printf("processing range %d\n", (int)i);
        }
        if ((range_start + i) == 0)
        {
            process_range_zero();
        }
        else
        {
            process_range(range_start + i);
        }
    }
}
