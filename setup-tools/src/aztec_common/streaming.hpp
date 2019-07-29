/**
 * Setup
 * Copyright Spilsbury Holdings 2019
 *
 **/
#pragma once

#include <gmp.h>
#include <memory.h>
#include <sys/stat.h>
#include <fstream>
#include <vector>

#include <libff/algebra/fields/bigint.hpp>
#include <libff/algebra/curves/public_params.hpp>

#include "assert.hpp"
#include "checksum.hpp"

constexpr int GMP_NUMB_BYTES = GMP_NUMB_BITS / 8;

namespace streaming
{
template <typename FieldT>
void write_element_to_buffer(FieldT &element, char *buffer);

template <typename FieldT>
void write_field_elements_to_file(std::vector<FieldT> &coefficients, const char *filename);

template <size_t N>
void write_bigint_to_buffer(libff::bigint<N> &value, char *buffer);

template <typename FieldT>
void write_fq_element_to_buffer(FieldT &element, char *buffer);

template <typename GroupT>
void write_g1_element_to_buffer(GroupT &element, char *buffer);

template <typename GroupT>
void write_g2_element_to_buffer(GroupT &element, char *buffer);

template <typename FieldT, typename GroupT>
void write_g1_elements_to_buffer(GroupT *elements, char *buffer, size_t degree);

template <typename FieldT, typename GroupT>
void write_g2_elements_to_buffer(GroupT *elements, char *buffer, size_t degree);

template <typename FieldT>
void read_field_elements_from_file(std::vector<FieldT> &coefficients, const char *filename, size_t degree);

template <typename FieldT, typename GroupT>
void read_g1_elements_from_buffer(GroupT *elements, char *buffer, size_t buffer_size);

template <typename FieldT, typename GroupT>
void read_g2_elements_from_buffer(GroupT *elements, char *buffer, size_t buffer_size);

inline bool isLittleEndian()
{
    int num = 42;
    return (*(char *)&num == 42);
}

inline int32_t read_int32_t(char const *buffer)
{
    return isLittleEndian() ? __builtin_bswap32(*(int32_t *)buffer) : *(int32_t *)buffer;
}

inline void write_int32_t(char const *buffer, int32_t length)
{
    *(int32_t *)buffer = isLittleEndian() ? __builtin_bswap32(length) : length;
}

inline size_t get_file_size(std::string const &filename)
{
    struct stat st;
    if (stat(filename.c_str(), &st) != 0)
    {
        return 0;
    }
    return st.st_size;
}

inline std::vector<char> read_file_into_buffer(std::string const &filename, size_t offset = 0, size_t size = 0)
{
    size_t file_size = size ? size : get_file_size(filename);
    std::vector<char> buffer(file_size);
    std::ifstream file;
    file.open(filename, std::ifstream::binary);
    file.seekg(offset);
    file.read(&buffer[0], buffer.size());
    file.close();
    return buffer;
}

inline void write_buffer_to_file(std::string const &filename, std::vector<char> const &buffer)
{
    std::ofstream file;
    file.open(filename);
    file.write(&buffer[0], buffer.size());
    file.close();
}

inline void add_checksum_to_buffer(char *buffer, size_t message_size)
{
    checksum::create_checksum(buffer, message_size, buffer + message_size);
}

inline void validate_checksum(std::vector<char> const &buffer)
{
    const size_t message_size = buffer.size() - checksum::BLAKE2B_CHECKSUM_LENGTH;
    char checksum[checksum::BLAKE2B_CHECKSUM_LENGTH] = {0};
    checksum::create_checksum(&buffer[0], message_size, &checksum[0]);
    char const *comparison = &buffer[0] + message_size;
    for (size_t i = 0; i < checksum::BLAKE2B_CHECKSUM_LENGTH; ++i)
    {
        ASSERT(checksum[i] == comparison[i]);
        if (checksum[i] != comparison[i])
        {
            throw std::runtime_error("Checksum failed.");
        }
    }
}
}; // namespace streaming
#include "streaming.tcc"