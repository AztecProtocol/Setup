#include <libff/algebra/curves/public_params.hpp>
#include <libff/algebra/fields/fp.hpp>
#include <libff/algebra/scalar_multiplication/multiexp.hpp>
#include <libff/algebra/curves/curve_utils.hpp>
#include <libff/algebra/scalar_multiplication/wnaf.hpp>
#include <libff/algebra/curves/alt_bn128/alt_bn128_pp.hpp>
#include <aztec_common/timer.hpp>
#include <aztec_common/streaming.hpp>
#include <fstream>

using FieldT = libff::Fr<libff::alt_bn128_pp>;
using FieldQT = libff::Fq<libff::alt_bn128_pp>;
using GroupT = libff::G1<libff::alt_bn128_pp>;

constexpr size_t POLYNOMIAL_DEGREE = 0x10000;

template <typename FieldQT, typename FieldT, typename GroupT>
void load_field_and_group_elements(std::vector<FieldT> &generator_polynomial, std::vector<GroupT> &g1_x, size_t polynomial_degree)
{
  std::cout << "Loading data..." << std::endl;

  Timer timer;

  const size_t g1_buffer_size = sizeof(FieldQT) * 2 * polynomial_degree;

  char *read_buffer = (char *)malloc(g1_buffer_size + checksum::BLAKE2B_CHECKSUM_LENGTH);
  assert(read_buffer != nullptr);

  streaming::read_field_elements_from_file(generator_polynomial, "../post_processing_db/generator.dat", polynomial_degree + 1);
  g1_x.resize(polynomial_degree + 1);
  streaming::read_file_into_buffer("../setup_db/g1_x_current.dat", read_buffer, g1_buffer_size);
  streaming::read_g1_elements_from_buffer<FieldQT, GroupT>(&g1_x[1], read_buffer, g1_buffer_size);
  streaming::validate_checksum(read_buffer, g1_buffer_size);
  g1_x[0] = GroupT::one();
  free(read_buffer);

  std::cout << "Loaded in " << timer.toString() << "s" << std::endl;
}

int main(int argc, char **argv)
{
  const size_t polynomial_degree = argc > 1 ? strtol(argv[1], NULL, 0) : POLYNOMIAL_DEGREE;

  libff::alt_bn128_pp::init_public_params();

  std::vector<FieldT> generator_polynomial;
  std::vector<GroupT> g1_x;

  load_field_and_group_elements<FieldQT, FieldT, GroupT>(generator_polynomial, g1_x, polynomial_degree);

  std::cout << "Transforming..." << std::endl;

  Timer timer;

  {
    std::ofstream file("../post_processing_db/generator_prep.dat");
    file.write((char *)&generator_polynomial[0], generator_polynomial.size() * sizeof(FieldT));
  }

  {
    std::ofstream file("../post_processing_db/g1_x_prep.dat");
    file.write((char *)&g1_x[0], generator_polynomial.size() * sizeof(GroupT));
  }

  std::cout << "Transformed and written in " << timer.toString() << "s" << std::endl;

  return 0;
}