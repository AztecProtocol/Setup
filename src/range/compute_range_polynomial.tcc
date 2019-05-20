/**
 * Setup
 * Copyright Spilsbury Holdings 2019
 * 
 **/
#include <stdlib.h>
#include <vector>
#include <string.h>
#include <sstream>

#include <aztec_common/streaming.hpp>
#include <aztec_common/checksum.hpp>

#include <libfqfft/polynomial_arithmetic/basic_operations.hpp>
#include <libff/algebra/scalar_multiplication/multiexp.hpp>
#include <libff/algebra/curves/public_params.hpp>
#include <libff/algebra/curves/curve_utils.hpp>
#include <libff/algebra/scalar_multiplication/wnaf.hpp>

namespace range
{
namespace
{

// std::string create_file_name(size_t k)
// {
//     std::stringstream ss;
//     ss << "./range_" << k << ".dat";
//     return ss.str();
// }
} // namespace

template <typename FieldT, size_t M>
void compute_range_polynomial(FieldT* generator_polynomial, FieldT* range_polynomial, size_t range_integer)
{
    const FieldT divisor_value = FieldT(range_integer);
    switch (range_integer == 0)
    {
        case 0:
        {
            memcpy(range_polynomial, generator_polynomial, M * sizeof(FieldT));
            const FieldT divisor_inverse = divisor_value.is_zero() ? FieldT::zero() : (-divisor_value).inverse();
            range_polynomial[0] = generator_polynomial[0] * divisor_inverse;
            for (size_t i = 1; i < M; ++i)
            {
                range_polynomial[i] -= range_polynomial[i - 1];
                range_polynomial[i] *= divisor_inverse;
            }
            break;
        }
        case 1:
        {
            memcpy(range_polynomial, &generator_polynomial[1], M * sizeof(FieldT));
            break;
        }
    }

}

template <typename FieldT, typename GroupT>
struct GeneratorData
{
    typename std::vector<FieldT>::const_iterator generator_start;
    typename std::vector<FieldT>::const_iterator generator_end;
    typename std::vector<GroupT>::const_iterator powers_of_x_start;
    typename std::vector<GroupT>::const_iterator powers_of_x_end;
};

template <typename FieldT, typename GroupT>
struct EvaluationSlice
{
    bool is_first_slice;
    size_t range_index_start;
    size_t range_index_end;
    std::vector<FieldT> previous_slice_coefficients;
    std::vector<GroupT> previous_evaluation_results;
    typename std::vector<FieldT>::const_iterator generator_start;
    typename std::vector<FieldT>::const_iterator generator_end;
    typename std::vector<GroupT>::const_iterator powers_of_x_start;
    typename std::vector<GroupT>::const_iterator powers_of_x_end;
};

template <typename FieldT, typename GroupT>
void compute_evaluation_slice(EvaluationSlice<FieldT, GroupT>& slice, EvaluationSlice<FieldT, GroupT>& next_slice)
{
    for (size_t i = slice.range_index_start; i < slice.range_index_end; ++i)
    {
        // TODO: if i == 0 we need to shift generator iterator
        FieldT divisor_inverse = (i == 0) ? FieldT::one() : -FieldT(i).inverse();
        std::vector<FieldT> range_polynomial_coefficients(slice.generator_start, slice.generator_end);
        if (i != 0)
        {
            if (!slice.is_first_slice)
            {
                range_polynomial_coefficients[0] -= slice.previous_slice_coefficients[i];
            }
            range_polynomial_coefficients[0] *= divisor_inverse;
            for (size_t j = 1; j < range_polynomial_coefficients.size(); ++j)
            {
                range_polynomial_coefficients[j] -= range_polynomial_coefficients[j - 1];
                range_polynomial_coefficients[j] *= divisor_inverse;
            }
        }
        next_slice.previous_slice_coefficients.emplace_back(range_polynomial_coefficients[range_polynomial_coefficients.size() - 1]);
        GroupT result = libff::multi_exp<GroupT, FieldT, libff::multi_exp_method_bos_coster>(
            range_polynomial_coefficients.begin(),
            range_polynomial_coefficients.end(),
            slice.powers_of_x_start,
            slice.powers_of_x_end
        );
        if (!slice.is_first_slice)
        {
            result += slice.previous_evaluation_result[i];
        }
        next_slice.previous_evaluation_results.emplace_back(result);
    }
}

template <typename FieldT, typename GroupT>
std::vector<std::vector<EvaluationSlice<FieldT, GroupT> > > preprocess_evaluation_slices(size_t range_max, size_t polynomial_degree, GeneratorData<FieldT, GroupT>& generator_data)
{
    constexpr size_t evaluation_size = RANGES_PER_SLICE * DEGREES_PER_SLICE;
    size_t global_size = range_max * polynomial_degree;
    size_t num_evaluation_slices = global_size / evaluation_size;

    size_t evaluation_range = range_max / RANGES_PER_SLICE;
    size_t evaluation_degree = polynomial_degree / DEGREES_PER_SLICE;
    // TODO VALIDATE THESE DIVIDES PERFECTLY

    std::vector<std::vector<EvaluationSlice<FieldT, GroupT> > > evaluation_slices;
    evaluation_slices.reserve(evaluation_degree + 1);
    // preprocess evaluation_results
    for (size_t i = 0; i < evaluation_degree; ++i)
    {
        evaluation_slices.emplace_back(new std::vector<EvaluationSlice<FieldT, GroupT> >);
        evaluation_slices[i].reserve(evaluation_range);
        typename std::vector<FieldT>::iterator generator_start = generator_data.generator_start + (i * DEGREES_PER_SLICE);
        typename std::vector<FieldT>::iterator generator_end = generator_start + DEGREES_PER_SLICE;
        for (size_t j = 0; j < evaluation_range; ++j)
        {
            EvaluationSlice<FieldT, GroupT> current;
            current.is_first_slice = (i == 0);
            if (j == 0)
            {
                current.generator_start = generator_start + 1;
                current.generator_end = generator_end + 1;
            }
            else
            {
                current.generator_start = generator_start;
                current.generator_end = generator_end;
            }
            current.powers_of_x_start = generator_data.powers_of_x_start + (j * RANGES_PER_SLICE);
            current.powers_of_x_end = current.powers_of_x_start + RANGES_PER_SLICE;
            current.range_index_start = (j * RANGES_PER_SLICE);
            current.range_index_end = current.range_index_start + RANGES_PER_SLICE;
            evaluation_slices[i].emplace_back(current);
        }
    }
    // add final vector to collate results
    evaluation_slices.emplace_back(new std::vector<EvaluationSlice<FieldT, GroupT> >);
    evaluation_slices[evaluation_slices.size() - 1].resize(evaluation_range);
    return evaluation_slices;
}

// template <typename FieldT, typename GroupT>
// void compute_range_polynomial_slice(size_t de)

template <typename ppT>
void compute_range_polynomials(size_t range, size_t polynomial_degree)
{
    using Fr = libff::Fr<ppT>;
    using G1 = libff::G1<ppT>;

    constexpr size_t G1_BUFFER_SIZE = sizeof(libff::Fq<ppT>) * 2 * polynomial_degree;

    std::vector<Fr> generator_polynomial;
    std::vector<Fr> range_polynomial(polynomial_degree, Fr::zero());

    streaming::read_field_elements_from_file(generator_polynomial, "generator.dat", polynomial_degree);

    // ### Setup G1 arrays
    std::vector<G1> g1_x;
    g1_x.resize(polynomial_degree);

    char* read_write_buffer = (char*)malloc(G1_BUFFER_SIZE + checksum::BLAKE2B_CHECKSUM_LENGTH);
    streaming::read_file_into_buffer("./setup_db/g1_x_current.dat", read_write_buffer, G1_BUFFER_SIZE);
    streaming::read_g1_elements_from_buffer<Fq, G1>(&g1_x[0], read_write_buffer, G1_BUFFER_SIZE);
    streaming::validate_checksum(read_write_buffer, G1_BUFFER_SIZE);

    GeneratorData<Fr, G1> generator_data;
    generator_data.generator_start = generator_polynomial.begin();
    generator_data.generator_end = generator_polynomial.end();
    generator_data.powers_of_x_start = g1_x.begin();
    generator_data.powers_of_x_end = g1_x.end();

    std::vector<std::vector<EvaluationSlice<Fr, G1> > > slices = preprocess_evaluation_slices(range, polynomial_degree, generator_data);

    for (size_t i = 0; i < slices.size() - 1; ++i)
    {
        // TODO: multithread this bit
        for (size_t j = 0; j < slices[i].size(); ++j)
        {
            compute_evaluation_slice<Fr, Gt>(slices[i][j], slices[i + 1][j]);
        }
    }

    std::vector<G1> setup_output;
    setup_output.resize(range);

    for (size_t i = 0; i < slices[polynomial_degree].size(); ++i)
    {
        for (size_t j = 0; j < slices[polynomial_degree][i].previous_evaluation_results.size(); ++j)
        {
            setup_output.emplace_back(slices[polynomial_degree][i].previous_evaluation_results[j]);
        }
    }


    streaming::write_g1_elements_to_buffer<Fq, G1>(&setup_output[0], read_write_buffer, POLYNOMIAL_DEGREE); // "g1_x.dat");
    streaming::add_checksum_to_buffer(read_write_buffer, G1_BUFFER_SIZE);
    streaming::write_buffer_to_file("./post_processing_db/point_data.dat", read_write_buffer, G1_BUFFER_SIZE);

    free(read_write_buffer);

    // for (size_t i = index; i < range; ++i)
    // {
    //     // if (i % 100 == 0)
    //     // {
    //     //     printf("i = %d\n", (int)i);
    //     //     range_polynomial[M - 1].print();
    //     // }
    //     compute_range_polynomial<ppT, M>(&generator_polynomial[0], &range_polynomial[0], i);
    //     // std::string filename = create_file_name(i);
    //     // streaming::write_field_elements_to_file(range_polynomial, filename.c_str());
    // }
}
} // namespace range
