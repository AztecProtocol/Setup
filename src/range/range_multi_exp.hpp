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

namespace range
{
constexpr size_t POLYNOMIAL_DEGREE = 0x1000;
constexpr size_t RANGE_PER_WINDOW = 1;
constexpr size_t DEGREE_PER_WINDOW = 0x500;

template <typename FieldT>
constexpr size_t G1_BUFFER_SIZE = sizeof(FieldT) * 2 * POLYNOMIAL_DEGREE;

template <typename FieldT>
constexpr size_t G1_ELEMENT_SIZE = sizeof(FieldT) * 2;

namespace
{
template <typename FieldQT, typename FieldT, typename GroupT>
void load_field_and_group_elements(std::vector<FieldT>& generator_polynomial, std::vector<GroupT>& g1_x)
{
    char *read_buffer = (char *)malloc(G1_BUFFER_SIZE<FieldQT> + checksum::BLAKE2B_CHECKSUM_LENGTH);
    if (read_buffer == nullptr)
    {
        // printf("error, could not allocate memory for read buffer!\n");
    }
    streaming::read_field_elements_from_file(generator_polynomial, "../post_processing_db/generator.dat", POLYNOMIAL_DEGREE + 1);
    g1_x.resize(POLYNOMIAL_DEGREE + 1);
    streaming::read_file_into_buffer("../setup_db/g1_x_current.dat", read_buffer, G1_BUFFER_SIZE<FieldQT>);
    // printf("read buffer = %lx\n", (size_t)read_buffer);
    // printf("g1 buffer size = %lx\n", (size_t)G1_BUFFER_SIZE<FieldQT>);
    // for (size_t i = 0; i < G1_BUFFER_SIZE<FieldQT>; ++i)
    // {
    //     printf("[%d]: %d\n", (int)i, (int)read_buffer[i]);
    // }
    streaming::read_g1_elements_from_buffer<FieldQT, GroupT>(&g1_x[1], read_buffer, G1_BUFFER_SIZE<FieldQT>);
    streaming::validate_checksum(read_buffer, G1_BUFFER_SIZE<FieldQT>);
    g1_x[0] = GroupT::one();
    // for (size_t i = 0; i < POLYNOMIAL_DEGREE; ++i)
    // {
    //     printf("from buffer, g1_x[%d]:\n", (int)i);
    //     g1_x[i].print();
    // }
    // printf("freeing read buffer\n");
    free(read_buffer);
    // printf("freed read buffer\n");
}

template <typename FieldQT, typename FieldT, typename GroupT>
void write_field_and_group_accumulators(std::vector<FieldT>& field_accumulators, std::vector<GroupT> &group_accumulators)
{
    // TODO pick useful file names
    char *write_buffer = (char *)malloc(G1_BUFFER_SIZE<FieldQT> + checksum::BLAKE2B_CHECKSUM_LENGTH);
    if (write_buffer == nullptr)
    {
        printf("error, could not allocate memory for write buffer!\n");
    }
    streaming::write_g1_elements_to_buffer<FieldQT, GroupT>(&(group_accumulators[0]), write_buffer, POLYNOMIAL_DEGREE);
    streaming::add_checksum_to_buffer(write_buffer, G1_BUFFER_SIZE<FieldQT>);
    streaming::write_buffer_to_file("../post_processing_db/group_accumulators.dat", write_buffer, G1_BUFFER_SIZE<FieldQT>);
    streaming::write_field_elements_to_file(field_accumulators, "../post_processing_db/field_accumulators.dat");
    // printf("freeing write buffer\n");
    free(write_buffer);
    // printf("freed write buffer\n");
}
} // namespace

template <typename ppT>
void compute_range_polynomials(int range_index)
{
    ASSERT((POLYNOMIAL_DEGREE / DEGREE_PER_WINDOW) * DEGREE_PER_WINDOW == POLYNOMIAL_DEGREE)
    using Fr = libff::Fr<ppT>;
    using Fq = libff::Fq<ppT>;
    using G1 = libff::G1<ppT>;
    using WindowInstance = Window<Fr, G1, RANGE_PER_WINDOW, DEGREE_PER_WINDOW>;

    // ### Setup Fr array
    std::vector<Fr> generator_polynomial;
    // ### Setup G1 arrays
    std::vector<G1> g1_x;
    load_field_and_group_elements<Fq, Fr, G1>(generator_polynomial, g1_x);

    WindowInstance window = WindowInstance(&g1_x, &generator_polynomial, range_index, 0);

    for (size_t i = 0; i < (POLYNOMIAL_DEGREE / DEGREE_PER_WINDOW) - 1; ++i)
    {
        window.process();
        // printf("advancing window\n");
        window.advance_window();
        // printf("advanced window\n");
    }
    // printf("calling process for last time \n");
    window.process();

    // printf("getting pointers to group and field accumulators\n");
    std::vector<G1> &group_accumulators = *(window.get_group_accumulators());
    std::vector<Fr> &field_accumulators = *(window.get_field_accumulators());

    // printf("calling batch normalize\n");
    batch_normalize::batch_normalize<Fq, G1>(0, RANGE_PER_WINDOW, &(group_accumulators[0]));
    // printf("called batch normalize\n");
    for (size_t i = 0; i < RANGE_PER_WINDOW; ++i)
    {
        group_accumulators[i].print();
    }
    // printf("writing field and group accumulators\n");
    write_field_and_group_accumulators<Fq, Fr, G1>(field_accumulators, group_accumulators);
}
} // namespace range