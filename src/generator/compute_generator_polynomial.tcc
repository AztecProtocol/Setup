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

#include <libfqfft/polynomial_arithmetic/basis_change.hpp>
#include <libfqfft/evaluation_domain/evaluation_domain.hpp>
#include <libfqfft/evaluation_domain/domains/arithmetic_sequence_domain.hpp>

#include <aztec_common/streaming.hpp>

#include "compute_generator_polynomial.hpp"

namespace generator
{
template <typename FieldT, size_t M>
void compute_generator_polynomial()
{
    std::vector<std::vector<std::vector<FieldT>>> subproduct_tree;

    libfqfft::compute_subproduct_tree(log2(M), subproduct_tree);

    std::vector<FieldT> result = subproduct_tree[log2(M)][0];
    printf("result size = %d\n", (int)result.size());
    // printf("printing polynomial\n");
    // for (size_t i = 0; i < result.size(); ++i)
    // {
    //     result[i].print();
    // }
    // printf("printing mont repr\n");
    // for (size_t i = 0; i < result.size(); ++i)
    // {
    //     for (size_t j = 0; j < 4; ++j)
    //     {
    //         std::cout << std::hex << (size_t)result[i].mont_repr.data[j] << " ";
    //     }
    //     std::cout << std::endl;
    // }
    // printf("printing bigint\n");
    // for (size_t i = 0; i < result.size(); ++i)
    // {
    //     auto raw = result[i].as_bigint();
    //     for (size_t j = 0; j < 4; ++j)
    //     {
    //         std::cout << std::hex << (size_t)raw.data[j] << " ";
    //     }
    //     std::cout << std::endl;
    //     FieldT reconstructed = FieldT(raw);
    //     std::cout << "reconstructed from raw:" << std::endl;
    //     reconstructed.print();
    // }
    streaming::write_coefficients_to_file(result, "generator.dat");
    // printf("firsts \n");
    // for (size_t i = 0; i < subproduct_tree[0].size(); ++i)
    // {
    //     printf("%d : %d \n", 0, i);
    //     for (size_t j = 0; j < subproduct_tree[0][i].size(); ++j)
    //     {
    //         subproduct_tree[0][i][j].print();
    //     }
    // }
    // printf("end \n");
    // size_t bytes_per_element = 32; // TODO make dynamic
    // size_t num_bytes = result.size() * bytes_per_element;
}
} // namespace generator
