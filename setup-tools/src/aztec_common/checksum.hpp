/**
 * Setup
 * Copyright Spilsbury Holdings 2019
 *
 **/
#pragma once

#include <stddef.h>
#include <blake2.h>
#include <iostream>

namespace checksum
{
constexpr size_t BLAKE2B_CHECKSUM_LENGTH = 64;

inline void create_checksum(char const *buffer, size_t buffer_size, char *checksum)
{
    blake2b((void *)checksum, BLAKE2B_CHECKSUM_LENGTH, (void *)buffer, buffer_size, nullptr, 0);
}
} // namespace checksum