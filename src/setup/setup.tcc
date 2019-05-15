// #include "setup.hpp"
#include <string.h>
#include <stdlib.h>
#include <iostream>

// #include <libff/algebra/scalar_multiplication/multiexp.hpp>
#include <libff/common/profiling.hpp>
#include <libff/common/utils.hpp>
#include <libff/algebra/curves/public_params.hpp>
#include <libff/algebra/curves/curve_utils.hpp>

#include <aztec_common/streaming.hpp>

#include "utils.hpp"

namespace setup
{
std::string create_file_name(size_t k)
{
    std::stringstream ss;
    ss << "./range_" << k << ".dat";
    return ss.str();
}

template <
    typename FieldT,
    typename Field2T,
    typename ScalarT,
    typename Group1T,
    typename Group2T
> void run_setup(bool init)
{
    constexpr size_t G1_BUFFER_SIZE = sizeof(FieldT) * 2 * POLYNOMIAL_DEGREE;
    constexpr size_t G2_BUFFER_SIZE = sizeof(FieldT) * 4 * POLYNOMIAL_DEGREE;

    printf("inside run setup\n");
    ScalarT accumulator = ScalarT::random_element();
    std::vector<Group1T> g1_x;
    std::vector<Group1T> g1_alpha_x;
    std::vector<Group2T> g2_x;
    std::vector<Group2T> g2_alpha_x;
    printf("resizing vectors\n");
    g1_x.resize(POLYNOMIAL_DEGREE);
    g1_alpha_x.resize(POLYNOMIAL_DEGREE);
    g2_x.resize(POLYNOMIAL_DEGREE);
    g2_alpha_x.resize(POLYNOMIAL_DEGREE);

    // GET DATABASE FROM FILE
    // (INIT)
    if (init)
    {
        printf("about to zero polynomials\n");
        for (size_t i = 0; i < POLYNOMIAL_DEGREE; ++i)
        {
            if (i % 100000 == 0)
            {
                printf("i = %d\n", (int)i);
            }
            g1_x[i] = Group1T::one();
            g1_alpha_x[i] = Group1T::one();
            g2_x[i] = Group2T::one();
            g2_alpha_x[i] = Group2T::one();
        }
    }
    else
    {

    }
    printf("zeroed polynomials, about to compute group elements\n");
    for (size_t i = 0; i < POLYNOMIAL_DEGREE; ++i)
    {
        if (i % 1000 == 0)
        {
            printf("group element i = %d\n", (int)i);
        }
        g1_x[i] = accumulator * g1_x[i];
        g1_alpha_x[i] = accumulator * g1_alpha_x[i];
        g2_x[i] = accumulator * g2_x[i];
        g2_alpha_x[i] = accumulator * g2_alpha_x[i];
        accumulator *= accumulator;
    }
    utils::batch_normalize<FieldT, Group1T>(0, POLYNOMIAL_DEGREE, &g1_x[0], &g1_alpha_x[0]);
    utils::batch_normalize<Field2T, Group2T>(0, POLYNOMIAL_DEGREE, &g2_x[0], &g2_alpha_x[0]);

    // set up write buffer
    char* write_buffer = (char*)malloc(G2_BUFFER_SIZE); // new char[sizeof(FieldT) * 4 * POLYNOMIAL_DEGREE];

    // write g1_x to file
    streaming::write_g1_elements_to_buffer<FieldT, Group1T>(g1_x, write_buffer); // "setup_g1_x.dat");
    streaming::write_buffer_into_file("setup_g1_x.dat", write_buffer, G1_BUFFER_SIZE);
    // write g1_alpha_x to file
    streaming::write_g1_elements_to_buffer<FieldT, Group1T>(g1_alpha_x, write_buffer); // "setup_g1_alpha_x.dat");
    streaming::write_buffer_into_file("setup_g1_alpha_x.dat", write_buffer, G1_BUFFER_SIZE);

    // write g2_x to file
    streaming::write_g2_elements_to_buffer<FieldT, Group2T>(g2_x, write_buffer); // "setup_g2_x.dat");
    streaming::write_buffer_into_file("setup_g2_x.dat", write_buffer, G2_BUFFER_SIZE);

    // write g2_alpha_x to file
    streaming::write_g2_elements_to_buffer<FieldT, Group2T>(g2_alpha_x, write_buffer); // "setup_g2_alpha_x.dat");
    streaming::write_buffer_into_file("setup_g2_alpha_x.dat", write_buffer, G2_BUFFER_SIZE);

    // wipe out accumulator. TODO: figure out a way of ensuring compiler doesn't remove this
    memset(&accumulator, 0x0, sizeof(FieldT));

    // free the memory we allocated to our write buffer
    free(write_buffer);
}
} // namespace setup
