/**
 * Setup
 * Copyright Spilsbury Holdings 2019
 **/
#include "streaming.hpp"
#include "compression.hpp"
#include <gmp.h>
#include <memory.h>
#include <stdint.h>
#include <fstream>
#include <iostream>
#include <sys/stat.h>

namespace streaming
{

namespace
{

template <typename FieldT>
void write_fq_to_buffer(FieldT &element, char *buffer)
{
    constexpr size_t num_limbs = sizeof(FieldT) / GMP_NUMB_BYTES;
    libff::bigint<num_limbs> value = element.as_bigint();
    write_bigint_to_buffer<num_limbs>(value, buffer);
}

} // namespace

void write_field_elements_to_file(std::vector<Fr> &coefficients, const char *filename)
{
    constexpr size_t bytes_per_element = sizeof(Fr);
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

void read_field_elements_from_file(std::vector<Fr> &coefficients, const char *filename, size_t degree)
{
    constexpr size_t bytes_per_element = sizeof(Fr);
    constexpr size_t num_limbs = sizeof(Fr) / GMP_NUMB_BYTES;
    const size_t length = (degree + 1) * bytes_per_element;

    std::vector<uint8_t> buffer;
    buffer.reserve(length);

    std::ifstream file;
    file.open(filename, std::ifstream::binary);
    file.read((char *)&*buffer.begin(), length);
    file.close();

    Fr element;
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
        coefficients.emplace_back(Fr(element_bigint));
    }
}

size_t get_file_size(std::string const &filename)
{
    struct stat st;
    if (stat(filename.c_str(), &st) != 0)
    {
        return 0;
    }
    return st.st_size;
}

bool is_file_exist(std::string const &fileName)
{
    std::ifstream infile(fileName);
    return infile.good();
}

std::vector<char> read_file_into_buffer(std::string const &filename, size_t offset, size_t size)
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

void write_buffer_to_file(std::string const &filename, std::vector<char> const &buffer)
{
    std::ofstream file;
    file.open(filename);
    file.write(&buffer[0], buffer.size());
    file.close();
}

std::vector<char> validate_checksum(std::vector<char> const &buffer)
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
    std::vector<char> result;
    result.insert(result.begin(), &checksum[0], &checksum[0] + checksum::BLAKE2B_CHECKSUM_LENGTH);
    return result;
}

void add_checksum_to_buffer(char *buffer, size_t message_size)
{
    checksum::create_checksum(buffer, message_size, buffer + message_size);
}

} // namespace streaming