#include <string.h>
#include <stdlib.h>
#include <iostream>
#include <stdio.h>
#include <string.h>

// #include <libff/algebra/scalar_multiplication/multiexp.hpp>
#include <libff/common/profiling.hpp>
#include <libff/common/utils.hpp>
#include <libff/algebra/curves/public_params.hpp>
#include <libff/algebra/curves/curve_utils.hpp>

#include <aztec_common/checksum.hpp>
#include <aztec_common/streaming.hpp>

#include "utils.hpp"

namespace setup
{
namespace
{
bool is_file_exist(const char *fileName)
{
    std::ifstream infile(fileName);
    return infile.good();
}
} // namespace

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
> void run_setup()
{
    constexpr size_t G1_BUFFER_SIZE = sizeof(FieldT) * 2 * POLYNOMIAL_DEGREE;
    constexpr size_t G2_BUFFER_SIZE = sizeof(FieldT) * 4 * POLYNOMIAL_DEGREE;

    printf("inside run setup\n");

    // our toxic waste... we must ensure this is wiped before this function goes out of scope!
    ScalarT accumulator = ScalarT::random_element();
    ScalarT multiplicand = accumulator;
    ScalarT alpha = ScalarT::random_element();

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
    // set up our read write buffer
    char* read_write_buffer = (char*)malloc(G2_BUFFER_SIZE + checksum::BLAKE2B_CHECKSUM_LENGTH);

    if (is_file_exist("setup_g1_x_current.dat"))
    {
        printf("previous setup transcript found, reading from disk...\n");
        streaming::read_file_into_buffer("setup_g1_x_current.dat", read_write_buffer, G1_BUFFER_SIZE);
        streaming::read_g1_elements_from_buffer<FieldT, Group1T>(&g1_x[0], read_write_buffer, G1_BUFFER_SIZE);
        streaming::validate_checksum(read_write_buffer, G1_BUFFER_SIZE);

        streaming::read_file_into_buffer("setup_g1_alpha_x_current.dat", read_write_buffer, G1_BUFFER_SIZE);
        streaming::read_g1_elements_from_buffer<FieldT, Group1T>(&g1_alpha_x[0], read_write_buffer, G1_BUFFER_SIZE);
        streaming::validate_checksum(read_write_buffer, G1_BUFFER_SIZE);

        streaming::read_file_into_buffer("setup_g2_x_current.dat", read_write_buffer, G2_BUFFER_SIZE);
        streaming::read_g2_elements_from_buffer<FieldT, Group2T>(&g2_x[0], read_write_buffer, G2_BUFFER_SIZE);
        streaming::validate_checksum(read_write_buffer, G2_BUFFER_SIZE);

        streaming::read_file_into_buffer("setup_g2_alpha_x_current.dat", read_write_buffer, G2_BUFFER_SIZE);
        streaming::read_g2_elements_from_buffer<FieldT, Group2T>(&g2_alpha_x[0], read_write_buffer, G2_BUFFER_SIZE);
        streaming::validate_checksum(read_write_buffer, G2_BUFFER_SIZE);
    }
    else
    {
        printf("could not find previous setup transcript, creating initial transcript...\n");
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

    printf("initialized setup polynomials, updating setup transcript...\n");
    for (size_t i = 0; i < POLYNOMIAL_DEGREE; ++i)
    {
        if (i % 1000 == 0)
        {
            printf("group element i = %d\n", (int)i);
        }
        g1_x[i] = accumulator * g1_x[i];
        g1_alpha_x[i] = alpha * accumulator * g1_alpha_x[i];
        g2_x[i] = accumulator * g2_x[i];
        g2_alpha_x[i] = alpha * accumulator * g2_alpha_x[i];
        accumulator = accumulator * multiplicand;
    }

    printf("updated setup transcript, converting points into affine form...\n");
    utils::batch_normalize<FieldT, Group1T>(0, POLYNOMIAL_DEGREE, &g1_x[0], &g1_alpha_x[0]);
    utils::batch_normalize<Field2T, Group2T>(0, POLYNOMIAL_DEGREE, &g2_x[0], &g2_alpha_x[0]);

    printf("writing setup transcript to disk...\n");
    std::rename("setup_g1_x_current.dat", "setup_g1_x_previous.dat");
    std::rename("setup_g1_alpha_x_current.dat", "setup_g1_alpha_x_previous.dat");
    std::rename("setup_g2_x_current.dat", "setup_g2_x_previous.dat");
    std::rename("setup_g2_alpha_x_current.dat", "setup_g2_alpha_x_previous.dat");

    // write g1_x to file
    streaming::write_g1_elements_to_buffer<FieldT, Group1T>(g1_x, read_write_buffer); // "setup_g1_x.dat");
    streaming::add_checksum_to_buffer(read_write_buffer, G1_BUFFER_SIZE);
    streaming::write_buffer_to_file("setup_g1_x_current.dat", read_write_buffer, G1_BUFFER_SIZE);

    // write g1_alpha_x to file
    streaming::write_g1_elements_to_buffer<FieldT, Group1T>(g1_alpha_x, read_write_buffer); // "setup_g1_alpha_x.dat");
    streaming::add_checksum_to_buffer(read_write_buffer, G1_BUFFER_SIZE);
    streaming::write_buffer_to_file("setup_g1_alpha_x_current.dat", read_write_buffer, G1_BUFFER_SIZE);

    // write g2_x to file
    streaming::write_g2_elements_to_buffer<Field2T, Group2T>(g2_x, read_write_buffer); // "setup_g2_x.dat");
    streaming::add_checksum_to_buffer(read_write_buffer, G2_BUFFER_SIZE);
    streaming::write_buffer_to_file("setup_g2_x_current.dat", read_write_buffer, G2_BUFFER_SIZE);

    // write g2_alpha_x to file
    streaming::write_g2_elements_to_buffer<Field2T, Group2T>(g2_alpha_x, read_write_buffer); // "setup_g2_alpha_x.dat");
    streaming::add_checksum_to_buffer(read_write_buffer, G2_BUFFER_SIZE);
    streaming::write_buffer_to_file("setup_g2_alpha_x_current.dat", read_write_buffer, G2_BUFFER_SIZE);

    // wipe out accumulator. Use explicit_bzero so that this does not get optimized away
    explicit_bzero((void*)&accumulator, sizeof(ScalarT));
    // and wipe out our multiplicand
    explicit_bzero((void*)&multiplicand, sizeof(ScalarT));
    // and alpha
    explicit_bzero((void*)&alpha, sizeof(ScalarT));

    // free the memory we allocated to our write buffer
    free(read_write_buffer);
    printf("done.\n");
}
} // namespace setup
