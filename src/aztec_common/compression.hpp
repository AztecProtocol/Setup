#pragma once

#include <libff/algebra/fields/bigint.hpp>

namespace compression
{
    template <size_t N, typename FieldT, typename GroupT>
    GroupT decompress(libff::bigint<N>& x, libff::bigint<N>& y);
};
#include "compression.tcc"
