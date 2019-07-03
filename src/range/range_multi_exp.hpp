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
constexpr size_t RANGE_PER_WINDOW = 1;

namespace
{
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
    // printf("read buffer = %lx\n", (size_t)read_buffer);
    // printf("g1 buffer size = %lx\n", (size_t)G1_BUFFER_SIZE<FieldQT>);
    // for (size_t i = 0; i < G1_BUFFER_SIZE<FieldQT>; ++i)
    // {
    //     printf("[%d]: %d\n", (int)i, (int)read_buffer[i]);
    // }
    streaming::read_g1_elements_from_buffer<FieldQT, GroupT>(&g1_x[1], read_buffer, g1_buffer_size);
    streaming::validate_checksum(read_buffer, g1_buffer_size);
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

} // namespace

template <typename ppT>
void compute_range_polynomials(int range_index, size_t polynomial_degree)
{
    const size_t degree_per_window = polynomial_degree / 2;
    ASSERT((polynomial_degree / degree_per_window) * degree_per_window == polynomial_degree)
    using Fr = libff::Fr<ppT>;
    using Fq = libff::Fq<ppT>;
    using G1 = libff::G1<ppT>;
    using WindowInstance = Window<Fr, G1, RANGE_PER_WINDOW>;

    // ### Setup Fr array
    std::vector<Fr> generator_polynomial;
    // ### Setup G1 arrays
    std::vector<G1> g1_x;
    load_field_and_group_elements<Fq, Fr, G1>(generator_polynomial, g1_x, polynomial_degree);

    WindowInstance window = WindowInstance(&g1_x, &generator_polynomial, range_index, 0, degree_per_window);

    for (size_t i = 0; i < (polynomial_degree / degree_per_window) - 1; ++i)
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

    // printf("calling batch normalize\n");
    batch_normalize::batch_normalize<Fq, G1>(0, RANGE_PER_WINDOW, &(group_accumulators[0]));
    // printf("called batch normalize\n");
    for (size_t i = 0; i < RANGE_PER_WINDOW; ++i)
    {
        group_accumulators[i].print();
    }
    // printf("writing field and group accumulators\n");
}
} // namespace range