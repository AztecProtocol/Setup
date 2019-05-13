// #include "setup.hpp"

// #include <libff/algebra/scalar_multiplication/multiexp.hpp>
#include <libff/common/profiling.hpp>
#include <libff/common/utils.hpp>
#include <libff/algebra/curves/public_params.hpp>
#include <libff/algebra/curves/curve_utils.hpp>

#include "utils.hpp"
#include "../common/streaming.hpp"

namespace setup
{
    std::string create_file_name(size_t k)
    {
        std::stringstream ss;
        ss << "./range_" << k << ".dat";
        return ss.str();
    }

    template <typename FieldT, typename ScalarT, typename Group1T, typename Group2T>
    void run_setup()
    {
        ScalarT accumulator = ScalarT::random_element();
        std::vector<Group1T> g1_x;
        std::vector<Group1T> g1_alpha_x;
        std::vector<Group2T> g2_x;
        std::vector<Group2T> g2_alpha_x;

        g1_x.resize(POLYNOMIAL_DEGREE);
        g1_alpha_x.resize(POLYNOMIAL_DEGREE);
        g2_x.resize(POLYNOMIAL_DEGREE);
        g2_alpha_x.resize(POLYNOMIAL_DEGREE);


        // GET DATABASE FROM FILE
        // (INIT)
        for (size_t i = 0; i < POLYNOMIAL_DEGREE; ++i)
        {
            g1_x[i] = Group1T::one();
            g1_alpha_x[i] = Group1T::one();
            g2_x[i] = Group2T::one();
            g2_alpha_x[i] = Group2T::one();
        }
        for (size_t i = 0; i < POLYNOMIAL_DEGREE; ++i)
        {
            g1_x[i] = accumulator * g1_x[i];
            g1_alpha_x[i] = accumulator * g1_alpha_x[i];
            g2_x[i] = accumulator * g2_x[i];
            g2_alpha_x[i] = accumulator * g2_alpha_x[i];
        }
        utils::batch_normalize<FieldT, Group1T>(0, POLYNOMIAL_DEGREE, &g1_x[0], &g1_alpha_x[0]);
        // utils::batch_normalize<FieldT, Group2T>(0, POLYNOMIAL_DEGREE, &g2_x[0], &g2_alpha_x[0]);

        streaming::write_group_elements_to_file<FieldT, Group1T>(g1_x, "setup_g1_x.dat");
        streaming::write_group_elements_to_file<FieldT, Group1T>(g1_alpha_x, "setup_g1_alpha_x.dat");

        // streaming::write_group_elements_to_file<FieldT, Group2T>(g2_x, "setup_g2_x.dat");
        // streaming::write_group_elements_to_file<FieldT, Group2T>(g2_alpha_x, "setup_g2_alpha_x.dat");
        // WRITE DATABASE TO FILE

        // wipe out accumulator. TODO: figure out a way of ensuring compiler doesn't remove this
        memset(&accumulator, 0x0, sizeof(FieldT));
    }
}
