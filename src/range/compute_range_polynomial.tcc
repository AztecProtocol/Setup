#include <stdlib.h>
#include <vector>
#include <string.h>
#include <sstream>

#include <aztec_common/streaming.hpp>

#include <libfqfft/polynomial_arithmetic/basic_operations.hpp>

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


template <typename FieldT, size_t M>
void compute_range_polynomials(size_t index, size_t range)
{
    std::vector<FieldT> generator_polynomial;
    std::vector<FieldT> range_polynomial(M, FieldT::zero());

    streaming::read_field_elements_from_file(generator_polynomial, "generator.dat", M);
    for (size_t i = index; i < range; ++i)
    {
        if (i % 100 == 0)
        {
            printf("i = %d\n", (int)i);
            range_polynomial[M - 1].print();
        }
        compute_range_polynomial<FieldT, M>(&generator_polynomial[0], &range_polynomial[0], i);
        // std::string filename = create_file_name(i);
        // streaming::write_field_elements_to_file(range_polynomial, filename.c_str());
    }
}
} // namespace range
