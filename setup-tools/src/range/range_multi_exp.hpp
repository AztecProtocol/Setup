/**
 * Setup
 * Copyright Spilsbury Holdings 2019
 *
 **/
#pragma once

#include <libff/algebra/curves/public_params.hpp>
#include <libff/algebra/fields/fp.hpp>
#include <libff/algebra/scalar_multiplication/multiexp.hpp>
#include <libff/algebra/curves/curve_utils.hpp>
#include <libff/algebra/scalar_multiplication/wnaf.hpp>

#include <aztec_common/assert.hpp>
#include <aztec_common/streaming.hpp>
#include <aztec_common/batch_normalize.hpp>

#include "window.hpp"

template <typename FieldQT, typename FieldT, typename GroupT>
void load_field_and_group_elements(std::vector<FieldT> &generator_polynomial, std::vector<GroupT> &g1_x, size_t polynomial_degree)
{
    const size_t g1_buffer_size = sizeof(FieldQT) * 2 * polynomial_degree;

    char *read_buffer = (char *)malloc(g1_buffer_size + checksum::BLAKE2B_CHECKSUM_LENGTH);
    if (read_buffer == nullptr)
    {
        // printf("error, could not allocate memory for read buffer!\n");
    }
    streaming::read_field_elements_from_file(generator_polynomial, "../post_processing_db/generator.dat", polynomial_degree + 1);
    g1_x.resize(polynomial_degree + 1);
    streaming::read_file_into_buffer("../setup_db/g1_x_current.dat", read_buffer, g1_buffer_size);
    streaming::read_g1_elements_from_buffer<FieldQT, GroupT>(&g1_x[1], read_buffer, g1_buffer_size);
    streaming::validate_checksum(read_buffer, g1_buffer_size);
    g1_x[0] = GroupT::one();
    free(read_buffer);
}

template <typename FieldT, typename GroupT>
GroupT process_range_zero(std::vector<GroupT> &powers_of_x, std::vector<FieldT> &generator_coefficients, size_t polynomial_degree)
{
    GroupT multiexp_result = libff::multi_exp<GroupT, FieldT, libff::multi_exp_method_bos_coster>(
        powers_of_x.begin(),
        powers_of_x.begin() + polynomial_degree,
        generator_coefficients.begin() + 1,
        generator_coefficients.end() + polynomial_degree + 1,
        1);
    return multiexp_result;
}

template <typename FieldT, typename GroupT>
GroupT process_range_single(int range_index, std::vector<GroupT> &powers_of_x, std::vector<FieldT> &generator_coefficients, size_t polynomial_degree)
{
    std::vector<FieldT> range_coefficients(generator_coefficients.begin(), generator_coefficients.begin() + polynomial_degree);
    FieldT divisor = (range_index == 0) ? FieldT::one() : (-FieldT(range_index)).inverse();
    range_coefficients[0] *= divisor;

    for (size_t i = 1; i < polynomial_degree; ++i)
    {
        range_coefficients[i] -= range_coefficients[i - 1];
        range_coefficients[i] *= divisor;
    }

    GroupT multiexp_result = libff::multi_exp<GroupT, FieldT, libff::multi_exp_method_bos_coster>(
        powers_of_x.begin(),
        powers_of_x.begin() + polynomial_degree,
        range_coefficients.begin(),
        range_coefficients.end(),
        1);

    return multiexp_result;
}

template <typename ppT>
void compute_range_polynomials(int range_index, size_t polynomial_degree)
{
    using Fr = libff::Fr<ppT>;
    using Fq = libff::Fq<ppT>;
    using G1 = libff::G1<ppT>;

    std::vector<Fr> generator_polynomial;
    std::vector<G1> g1_x;

    load_field_and_group_elements<Fq, Fr, G1>(generator_polynomial, g1_x, polynomial_degree);

    G1 result = range_index == 0
                    ? process_range_zero(g1_x, generator_polynomial, polynomial_degree)
                    : process_range_single(range_index, g1_x, generator_polynomial, polynomial_degree);

    result.print();
}