/**
 * Setup
 * Copyright Spilsbury Holdings 2019
 *
 **/
#include <stddef.h>
#include <vector>
#include <fstream>
#include <math.h>
#include <memory.h>

#include <gmp.h>
#include <time.h>
#include <libff/common/double.hpp>
#include <libfqfft/evaluation_domain/get_evaluation_domain.hpp>

#include <libff/algebra/curves/alt_bn128/alt_bn128_pp.hpp>
#include <libff/algebra/fields/field_utils.hpp>
#include <libfqfft/polynomial_arithmetic/basic_operations.hpp>

#include <string.h>
#include <stdio.h>

#include <aztec_common/streaming.hpp>

#include "compute_generator_polynomial.hpp"

namespace generator
{
template <typename FieldT>
std::vector<FieldT> compute_generator_polynomial(size_t polynomial_degree)
{
    size_t log2_polynomial_degree = log2(polynomial_degree);
    size_t acc = 1 << log2_polynomial_degree;
    if (acc < polynomial_degree)
    {
        ++log2_polynomial_degree;
        acc = acc * 2;
    }

    size_t num_rounds = log2_polynomial_degree;

    std::vector<std::vector<FieldT> > coefficients;

    FieldT work_var = FieldT::zero();

    // We want to compute the coefficients of the polynomial P(X) = (X - 0)(X - 1)...(X - n)
    // Start by creating vector of n degree-1 polynomials: X - 0, X - 1, ..., X - n
    // Then call `libfqfft::_polynomial_multiplication` on polynomial pairs
    // This will create n/2 vector of degree-2 polynomials: (X - 0)(X - 1), (X - 2)(X - 3), ..., (X - n-1)(X - n)
    // Repeat process of multiplying polynomial pairs, until we compute P(X)
    for (size_t i = 0; i < polynomial_degree; ++i)
    {
        std::vector<FieldT> init;
        init.emplace_back(work_var);
        init.emplace_back(FieldT::one());
        coefficients.emplace_back(init);
        work_var -= FieldT::one();
    }
    for (size_t i = polynomial_degree; i < acc; ++i)
    {
        std::vector<FieldT> init;
        init.emplace_back(FieldT::one());
        coefficients.emplace_back(init);
    }

    for (size_t i = 0; i < num_rounds; ++i)
    {
        std::vector<std::vector<FieldT> > work_vector;
        for (size_t j = 0; j < coefficients.size(); j += 2)
        {
            std::vector<FieldT> c(1, FieldT::zero());
            libfqfft::_polynomial_multiplication<FieldT>(c, coefficients[j], coefficients[j+1]);
            c.emplace_back(FieldT::zero());
            work_vector.emplace_back(c); 
        }
        work_vector.swap(coefficients);
    }

    libfqfft::_condense<FieldT>(coefficients[0]);
    return coefficients[0];
}
} // namespace generator
