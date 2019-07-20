/**
 * Setup
 * Copyright Spilsbury Holdings 2019
 *
 **/
#include <gmp.h>
#include <memory.h>
#include <fstream>
#include <vector>

#include <iostream>

#include "compression.hpp"

namespace streaming
{
namespace
{
constexpr bool USE_COMPRESSION = false;
// static constexpr size_t BYTES_PER_LIMB = sizeof(mp_limb_t) >> 3;
constexpr int GMP_NUMB_BYTES = GMP_NUMB_BITS / 8;

bool isLittleEndian()
{
    int num = 42;
    return (*(char *)&num == 42);
}

template <size_t N>
void __bswap_bigint(libff::bigint<N>& val)
{
    for (size_t i = 0; i < N; ++i)
    {
        val.data[i] = __bswap_64(val.data[i]);
    }
}
} // namespace

template <size_t N>
void write_bigint_to_buffer(libff::bigint<N>& value, char* buffer)
{
    mp_limb_t temp;
    for (size_t i = 0; i < N; ++i)
    {
        if (isLittleEndian())
        {
            temp = __builtin_bswap64(value.data[i]);
        }
        memcpy(buffer + (i * GMP_NUMB_BYTES), &temp, GMP_NUMB_BYTES);
    }
}

template <typename FieldT>
void write_fq_to_buffer(FieldT& element, char* buffer)
{
    constexpr size_t num_limbs = sizeof(FieldT) / GMP_NUMB_BYTES;
    libff::bigint<num_limbs> value = element.as_bigint();
    write_bigint_to_buffer<num_limbs>(value, buffer);
}

template <typename FieldT>
void write_field_elements_to_file(std::vector<FieldT> &coefficients, const char *filename)
{
    constexpr size_t bytes_per_element = sizeof(FieldT);
    // const size_t bytes_per_element = (bits_per_element >> 3) + ((bits_per_element & 0x7) > 0 ? 1 : 0);
    const size_t num_bytes = coefficients.size() * bytes_per_element;

    char *p = new char[num_bytes];
    for (size_t i = 0; i < coefficients.size(); ++i)
    {
        size_t byte_position = bytes_per_element * i;
        write_fq_to_buffer(coefficients[i], p + byte_position);
    }
    std::ofstream file;
    file.open(filename);
    file.write(p, num_bytes);
    file.close();
}

template <typename FieldT>
void read_field_elements_from_file(std::vector<FieldT> &coefficients, const char *filename, size_t degree)
{
    constexpr size_t bytes_per_element = sizeof(FieldT);
    constexpr size_t num_limbs = sizeof(FieldT) / GMP_NUMB_BYTES;
    const size_t length = (degree + 1) * bytes_per_element;

    std::vector<uint8_t> buffer;
    buffer.reserve(length);

    std::ifstream file;
    file.open(filename, std::ifstream::binary);
    file.read((char *)&*buffer.begin(), length);
    file.close();

    FieldT element;
    auto element_bigint = element.as_bigint();
    coefficients.reserve(degree + 1);
    for (size_t i = 0; i < length; i += bytes_per_element)
    {
        mp_limb_t *element_ptr = (mp_limb_t *)((char *)(&*buffer.begin()) + i);
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

} // namespace streaming

#include "streaming_g1.tcc"
#include "streaming_g2.tcc"