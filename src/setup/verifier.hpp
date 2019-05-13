#pragma once

#include <libff/common/profiling.hpp>
#include <libff/common/utils.hpp>
#include <libff/algebra/curves/public_params.hpp>
#include <libff/algebra/curves/curve_utils.hpp>

namespace verifier
{
    template <typename ppT>
    bool same_ratio_g1_g2(libff::G1_precomp<ppT>& public_key_precomp, libff::G1_precomp<ppT>& one_precomp, libff::G2<ppT>& first, libff::G2<ppT>& second)
    {
        libff::G2_precomp<ppT> lhs = ppT::precompute_G2(first);
        libff::G2_precomp<ppT> rhs = ppT::precompute_G2(-second);
        libff::Fqk<ppT> miller_result  = ppT::double_miller_loop(one_precomp, lhs, public_key_precomp, rhs);
        libff::GT<ppT> result = ppT::final_exponentiation(miller_result);
        return result == libff::GT<ppT>::one();
    }

    template <typename ppT>
    bool same_ratio_g2_g1(libff::G2_precomp<ppT>& public_key_precomp, libff::G2_precomp<ppT>& one_precomp, libff::G1<ppT>& first, libff::G1<ppT>& second)
    {
        libff::G1_precomp<ppT> lhs = ppT::precompute_G1(first);
        libff::G1_precomp<ppT> rhs = ppT::precompute_G1(-second);
        libff::Fqk<ppT> miller_result  = ppT::double_miller_loop(lhs, one_precomp, rhs, two_precomp);
        libff::GT<ppT> result = ppT::final_exponentiation(miller_result);
        return result == libff::GT<ppT>::one();
    }

    template <typename ppT>
    bool verify_transcript(libff::G1<ppT>& public_key, libff::G1<ppT>* database, libff::G2<ppT>* elements)
    {
        bool valid = true;
        libff::G1_precomp<ppT> public_key_precomp = ppT::precompute_G1(public_key);
        libff::G1_precomp<ppT> one_precomp = ppT::precompute_G1(G1<ppT>::one());
        libff::G2_precomp<ppT> public_key_precomp_g2 = ppT::precompute_G2(elements[0]);
        libff::G2_precomp<ppT> one_precomp_g2 = ppT::precompute_G2(G2<ppT>::one());
        for (size_t i = 0; i < POLYNOMIAL_DEGREE; ++i)
        {
            if (same_ratio_g1_g2<ppT>(public_key_precomp, one_precomp, elements[i], elements[i+1]))
            {
                valid = false;
                break;
            }
            if (same_ratio_g2_g1<ppT>(public_key_precomp_g2, one_precomp_g2, database[i], database[i+1]))
            {
                valid = false;
                break;
            }
        }
    }
}
