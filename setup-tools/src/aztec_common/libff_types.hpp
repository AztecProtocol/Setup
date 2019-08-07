#pragma once

#include <libff/common/profiling.hpp>
#include <libff/common/utils.hpp>
#include <libff/algebra/curves/public_params.hpp>
#include <libff/algebra/curves/curve_utils.hpp>
#include <libff/algebra/curves/alt_bn128/alt_bn128_pp.hpp>
#include <libff/common/profiling.hpp>
#include <libff/algebra/scalar_multiplication/multiexp.hpp>

using ppT = libff::alt_bn128_pp;
using Fq = libff::Fq<ppT>;
using Fqe = libff::Fqe<ppT>;
using G1 = libff::G1<ppT>;
using G2 = libff::G2<ppT>;
using G1_precomp = libff::G1_precomp<ppT>;
using G2_precomp = libff::G2_precomp<ppT>;
using Fr = libff::Fr<ppT>;
using Fqk = libff::Fqk<ppT>;
using GT = libff::GT<ppT>;

constexpr int GMP_NUMB_BYTES = GMP_NUMB_BITS / 8;