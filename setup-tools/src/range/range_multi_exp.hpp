/**
 * Setup
 * Copyright Spilsbury Holdings 2019
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
#include <aztec_common/timer.hpp>

#include "window.hpp"

template <typename FieldQT, typename FieldT, typename GroupT>
void load_field_and_group_elements(std::vector<FieldT> &generator_polynomial, std::vector<GroupT> &g1_x, size_t polynomial_degree)
{
    std::cerr << "Loading data..." << std::endl;

    Timer timer;

    const size_t g1_buffer_size = sizeof(FieldQT) * 2 * polynomial_degree;

    char *read_buffer = (char *)malloc(g1_buffer_size + checksum::BLAKE2B_CHECKSUM_LENGTH);
    assert(read_buffer != nullptr);

    streaming::read_field_elements_from_file(generator_polynomial, "../post_processing_db/generator.dat", polynomial_degree + 1);
    g1_x.resize(polynomial_degree + 1);
    streaming::read_file_into_buffer("../setup_db/g1_x_current.dat", read_buffer, g1_buffer_size);
    streaming::read_g1_elements_from_buffer<FieldQT, GroupT>(&g1_x[1], read_buffer, g1_buffer_size);
    streaming::validate_checksum(read_buffer, g1_buffer_size);
    g1_x[0] = GroupT::one();
    free(read_buffer);

    std::cerr << "Loaded in " << timer.toString() << "s" << std::endl;
}

template <typename FieldT, typename GroupT>
GroupT process_range_zero(const std::vector<GroupT> &powers_of_x, const std::vector<FieldT> &generator_coefficients, size_t start, size_t num)
{
    std::vector<FieldT>
        range_coefficients(generator_coefficients.begin() + 1 + start, generator_coefficients.begin() + 1 + start + num);
    GroupT multiexp_result = libff::multi_exp<GroupT, FieldT, libff::multi_exp_method_bos_coster>(
        powers_of_x.begin() + start,
        powers_of_x.begin() + start + num,
        range_coefficients.begin(),
        range_coefficients.end(),
        1);
    return multiexp_result;
}

template <typename FieldT, typename GroupT>
GroupT process_range_single(int range_index, FieldT &fa, const std::vector<GroupT> &powers_of_x, const std::vector<FieldT> &generator_coefficients, size_t start, size_t num)
{
    std::vector<FieldT> range_coefficients(generator_coefficients.begin() + start, generator_coefficients.begin() + start + num);
    FieldT divisor = (range_index == 0) ? FieldT::one() : (-FieldT(range_index)).inverse();
    range_coefficients[0] -= fa;
    range_coefficients[0] *= divisor;

    for (size_t i = 1; i < num; ++i)
    {
        range_coefficients[i] -= range_coefficients[i - 1];
        range_coefficients[i] *= divisor;
    }

    GroupT multiexp_result = libff::multi_exp<GroupT, FieldT, libff::multi_exp_method_bos_coster>(
        powers_of_x.begin() + start,
        powers_of_x.begin() + start + num,
        range_coefficients.begin(),
        range_coefficients.end(),
        1);

    fa = range_coefficients.back();

    return multiexp_result;
}

template <typename ppT>
void compute_range_polynomials(int range_index, size_t polynomial_degree)
{
    Timer totalTimer;
    using FieldT = libff::Fr<ppT>;
    using FieldQT = libff::Fq<ppT>;
    using GroupT = libff::G1<ppT>;

    std::vector<FieldT> generator_polynomial;
    std::vector<GroupT> g1_x;

    load_field_and_group_elements<FieldQT, FieldT, GroupT>(generator_polynomial, g1_x, polynomial_degree);

    size_t batchNum = 4;
    size_t batchSize = polynomial_degree / batchNum;
    std::vector<int> batches(batchNum);
    std::iota(batches.begin(), batches.end(), 0);
    FieldT fa = FieldT::zero();

    auto batcher = [&](int i) {
        return range_index == 0
                   ? process_range_zero(g1_x, generator_polynomial, batchSize * i, batchSize)
                   : process_range_single(range_index, fa, g1_x, generator_polynomial, batchSize * i, batchSize);
    };

    Timer computeTimer;
    std::vector<GroupT> results;
    std::transform(batches.begin(), batches.end(), std::back_inserter(results), batcher);
    GroupT result = std::accumulate(results.begin(), results.end(), GroupT::zero());

    std::cerr << "Compute time: " << computeTimer.toString() << "s" << std::endl;
    std::cerr << "Total time: " << totalTimer.toString() << "s" << std::endl;

    result.print();
}