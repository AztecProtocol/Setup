/**
 * Setup
 * Copyright Spilsbury Holdings 2019
 **/
#pragma once
#include <vector>
#include "libff_types.hpp"
#include "checksum.hpp"

#define __bswap_64 __builtin_bswap64

namespace streaming
{
constexpr bool USE_COMPRESSION = false;

void write_field_elements_to_file(std::vector<Fr> &coefficients, std::string const &filename);

void read_field_elements_from_file(std::vector<Fr> &coefficients, std::string const &filename);

size_t get_file_size(std::string const &filename);

std::vector<char> read_file_into_buffer(std::string const &filename, size_t offset = 0, size_t size = 0);

void write_buffer_to_file(std::string const &filename, std::vector<char> const &buffer);

bool is_file_exist(std::string const &fileName);

std::vector<char> validate_checksum(std::vector<char> const &buffer);

void add_checksum_to_buffer(char *buffer, size_t message_size);

template <size_t N>
void __bswap_bigint(libff::bigint<N> &val)
{
    for (size_t i = 0; i < N; ++i)
    {
        val.data[i] = __bswap_64(val.data[i]);
    }
}

inline bool isLittleEndian()
{
    int num = 42;
    return (*(char *)&num == 42);
}

template <size_t N>
void write_bigint_to_buffer(libff::bigint<N> &value, char *buffer)
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

inline int32_t read_int32_t(char const *buffer)
{
    return isLittleEndian() ? __builtin_bswap32(*(int32_t *)buffer) : *(int32_t *)buffer;
}

inline void write_int32_t(char const *buffer, int32_t length)
{
    *(int32_t *)buffer = isLittleEndian() ? __builtin_bswap32(length) : length;
}

}; // namespace streaming