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

#include <fcntl.h>
#include <unistd.h>
#include <sys/mman.h>
#include <sys/stat.h>

void *map_file(std::string const &filename)
{
    int fd = open(filename.c_str(), O_RDONLY);
    assert(fd != -1);

    struct stat sb;
    if (fstat(fd, &sb) != -1)
    {
        assert(false);
    }

    void *data = mmap(0, sb.st_size, PROT_READ, MAP_PRIVATE, fd, 0);
    assert(data != MAP_FAILED);
    close(fd);

    return data;
}

template <typename FieldT, typename GroupT>
GroupT process_range_zero(GroupT *const &powers_of_x, FieldT *const &generator_coefficients, size_t start, size_t num)
{
    return libff::multi_exp<GroupT, FieldT, libff::multi_exp_method_bos_coster>(
        (typename std::vector<GroupT>::const_iterator)powers_of_x + start,
        (typename std::vector<GroupT>::const_iterator)powers_of_x + start + num,
        (typename std::vector<FieldT>::const_iterator)generator_coefficients + 1 + start,
        (typename std::vector<FieldT>::const_iterator)generator_coefficients + 1 + start + num,
        1);
}

template <typename FieldT, typename GroupT>
GroupT process_range_single(int range_index, FieldT &fa, GroupT *const powers_of_x, FieldT *const generator_coefficients, size_t start, size_t num)
{
    std::vector<FieldT> range_coefficients(generator_coefficients + start, generator_coefficients + start + num);
    FieldT divisor = (-FieldT(range_index)).inverse();
    range_coefficients[0] -= fa;
    range_coefficients[0] *= divisor;

    for (size_t i = 1; i < num; ++i)
    {
        range_coefficients[i] -= range_coefficients[i - 1];
        range_coefficients[i] *= divisor;
    }

    GroupT multiexp_result = libff::multi_exp<GroupT, FieldT, libff::multi_exp_method_bos_coster>(
        (typename std::vector<GroupT>::const_iterator)powers_of_x + start,
        (typename std::vector<GroupT>::const_iterator)powers_of_x + start + num,
        range_coefficients.begin(),
        range_coefficients.end(),
        1);

    fa = range_coefficients.back();

    return multiexp_result;
}

template <typename FieldT, typename GroupT>
GroupT process_range(int range_index, FieldT &fa, GroupT *const powers_of_x, FieldT *const generator_coefficients, size_t start, size_t num)
{
    return range_index == 0
               ? process_range_zero(powers_of_x, generator_coefficients, start, num)
               : process_range_single(range_index, fa, powers_of_x, generator_coefficients, start, num);
}

template <typename ppT>
void compute_range_polynomials(int range_index, size_t polynomial_degree)
{
    Timer total_timer;
    using FieldT = libff::Fr<ppT>;
    using GroupT = libff::G1<ppT>;

    std::cerr << "Loading data..." << std::endl;
    Timer data_timer;
    FieldT *generator_polynomial = (FieldT *)map_file("../setup_db/generator_prep.dat");
    GroupT *g1_x = (GroupT *)map_file("../setup_db/g1_x_prep.dat");
    std::cerr << "Loaded in " << data_timer.toString() << "s" << std::endl;

    size_t batch_num = 4;
    size_t batch_size = polynomial_degree / batch_num;
    std::vector<int> batches(batch_num);
    std::iota(batches.begin(), batches.end(), 0);
    FieldT fa = FieldT::zero();

    auto batch_process = [&](int i) {
        return process_range(range_index, fa, g1_x, generator_polynomial, batch_size * i, batch_size);
    };

    Timer compute_timer;
    std::vector<GroupT> results;
    std::transform(batches.begin(), batches.end(), std::back_inserter(results), batch_process);
    GroupT result = std::accumulate(results.begin(), results.end(), GroupT::zero());

    std::cerr << "Compute time: " << compute_timer.toString() << "s" << std::endl;
    std::cerr << "Total time: " << total_timer.toString() << "s" << std::endl;

    result.print();
}