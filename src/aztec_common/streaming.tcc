#include <gmp.h>
#include <memory.h>
#include <fstream>
#include <vector>

#include <libff/algebra/fields/bigint.hpp>

#include <iostream>

namespace streaming
{
namespace
{
constexpr int GMP_NUMB_BYTES = GMP_NUMB_BITS / 8;
bool isLittleEndian()
{
    int num = 42;
    return (*(char *)&num == 42);
}
} // namespace

template <typename FieldT>
void read_coefficients_from_file(std::vector<FieldT> &coefficients, const char *filename, size_t degree)
{
    const size_t bits_per_element = FieldT::size_in_bits();
    const size_t bytes_per_element = (bits_per_element >> 3) + ((bits_per_element & 0x7) > 0 ? 1 : 0);
    const size_t length = (degree + 1) * bytes_per_element;

    printf("bytes per element = %d \n", (int)bytes_per_element);
    printf("degree = %d \n", (int)degree);
    // const size_t N = (bytes_per_element / GMP_NUMB_BYTES) + (bytes_per_element & (GMP_NUMB_BYTES - 1) ? 1 : 0);
    std::vector<uint8_t> buffer;
    buffer.reserve(length);

    std::ifstream file;
    file.open(filename, std::ifstream::binary);
    file.read((char *)&*buffer.begin(), length);

    FieldT element;
    size_t num_limbs = element.as_bigint().N;
    auto element_bigint = element.as_bigint();
    coefficients.reserve(degree + 1);
    for (size_t i = 0; i < length; i += bytes_per_element)
    {
        mp_limb_t *element_ptr = (mp_limb_t *)((char *)(&*buffer.begin()) + i);
        // size_t index = i / bytes_per_element;
        for (size_t j = 0; j < num_limbs; ++j)
        {
            mp_limb_t limb = element_ptr[j];
            if (isLittleEndian())
            {
                limb = __builtin_bswap64(limb);
            }
            element_bigint.data[j] = limb;
        }
        coefficients.emplace_back(FieldT(element_bigint));
    }
}


/*! \brief compress a G1 element and write to buffer
 *
 */
template <typename GroupT>
void write_group_element_to_buffer(GroupT& element, char* buffer)
{
    auto x = element.X.as_bigint();
    auto y = element.Y.as_bigint();
    for (size_t i = 0; i < x.N; ++i)
    {

    }
    mp_limb_t set = ((mp_limb_t)y.test_bit(0)) << (GMP_NUMB_BITS - 1);
    x.data[x.N - 1] = x.data[x.N - 1] | set;
    for (size_t i = 0; i < x.N; ++i)
    {
        mp_limb_t temp = x.data[i];
        if (isLittleEndian())
        {
            temp = __builtin_bswap64(temp);
        }
        memcpy(buffer + (GMP_NUMB_BYTES * i), &x, GMP_NUMB_BYTES);
    }
}

template <typename FieldT, typename GroupT>
void write_group_elements_to_file(std::vector<GroupT>& elements, const char *filename)
{
    const size_t bits_per_element = FieldT::size_in_bits();
    const size_t bytes_per_element = (bits_per_element >> 3) + ((bits_per_element & 0x7) > 0 ? 1 : 0);
    const size_t num_bytes = elements.size() * bytes_per_element;

    char *p = new char[num_bytes];
    for (size_t i = 0; i < elements.size(); ++i)
    {
        size_t byte_position = bytes_per_element * i;
        write_group_element_to_buffer<GroupT>(elements[i], p + byte_position);
    }
    std::ofstream file;
    file.open(filename);
    file.write(p, num_bytes);
    file.close();
}

template <typename FieldT>
void write_element_to_buffer(FieldT &element, char *buffer)
{
    size_t num_limbs = element.as_bigint().N;
    for (size_t i = 0; i < num_limbs; i++)
    {
        mp_limb_t temp = element.as_bigint().data[i];
        if (isLittleEndian())
        {
            temp = __builtin_bswap64(temp);
        }
        memcpy(buffer + (GMP_NUMB_BYTES * i), &temp, GMP_NUMB_BYTES);
    }
}

template <typename FieldT>
void write_coefficients_to_file(std::vector<FieldT> &coefficients, const char *filename)
{
    const size_t bits_per_element = FieldT::size_in_bits();
    const size_t bytes_per_element = (bits_per_element >> 3) + ((bits_per_element & 0x7) > 0 ? 1 : 0);
    const size_t num_bytes = coefficients.size() * bytes_per_element;

    char *p = new char[num_bytes];
    for (size_t i = 0; i < coefficients.size(); ++i)
    {
        size_t byte_position = bytes_per_element * i;
        write_element_to_buffer(coefficients[i], p + byte_position);
    }
    std::ofstream file;
    file.open(filename);
    file.write(p, num_bytes);
    file.close();
}
} // namespace streaming