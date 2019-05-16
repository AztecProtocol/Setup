#pragma once

#include <gmp.h>
#include <memory.h>
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
    void write_element_to_buffer(FieldT& element, char* buffer);

    template <typename FieldT>
    void write_field_elements_to_file(std::vector<FieldT>& coefficients, const char* filename);
    
    template <size_t N>
    void write_bigint_to_buffer(libff::bigint<N>& value, char* buffer);

    template <typename FieldT>
    void write_fq_element_to_buffer(FieldT& element, char* buffer);

    template <typename GroupT>
    void write_g1_element_to_buffer(GroupT& element, char* buffer);

    template <typename GroupT>
    void write_g2_element_to_buffer(GroupT& element, char* buffer);

    template <typename FieldT, typename GroupT>
    void write_g1_elements_to_buffer(std::vector<GroupT>& elements, char *buffer);

    template <typename FieldT, typename GroupT>
    void write_g2_elements_to_buffer(std::vector<GroupT>& elements, char *buffer);

    template <typename FieldT>
    void read_field_elements_from_file(std::vector<FieldT>& coefficients, const char* filename, size_t degree);

    template <typename FieldT, typename GroupT>
    void read_g1_elements_from_buffer(std::vector<GroupT>& elements, char* buffer, size_t buffer_size);

    template <typename FieldT, typename GroupT>
    void read_g2_elements_from_buffer(std::vector<GroupT>& elements, char* buffer, size_t buffer_size);

    inline void read_file_into_buffer(char const *filename, char *buffer, size_t message_size)
    {
        std::ifstream file;
        file.open(filename, std::ifstream::binary);
        file.read(buffer, message_size + checksum::BLAKE2B_CHECKSUM_LENGTH);
        file.close();
    }

    inline void write_buffer_to_file(char const *filename, char *buffer, size_t message_size)
    {
        std::ofstream file;
        file.open(filename);
        file.write(buffer, message_size + checksum::BLAKE2B_CHECKSUM_LENGTH);
        file.close();
    }

    inline void add_checksum_to_buffer(char* buffer, size_t message_size)
    {
        checksum::create_checksum(buffer, message_size, buffer + message_size);
    }

    inline void validate_checksum(char* buffer, size_t message_size)
    {
        char checksum[checksum::BLAKE2B_CHECKSUM_LENGTH] = { 0 };
        checksum::create_checksum(buffer, message_size, &checksum[0]);
        char* comparison = buffer + message_size;
        for (size_t i = 0; i < checksum::BLAKE2B_CHECKSUM_LENGTH; ++i)
        {
            ASSERT(checksum[i] == comparison[i]);
        }
    }
};
#include "streaming.tcc"