#include <libff/algebra/curves/public_params.hpp>
#include <libff/algebra/fields/fp.hpp>
#include <libff/algebra/scalar_multiplication/multiexp.hpp>
#include <libff/algebra/curves/curve_utils.hpp>
#include <libff/algebra/scalar_multiplication/wnaf.hpp>
#include <libff/algebra/curves/alt_bn128/alt_bn128_pp.hpp>
#include <aztec_common/timer.hpp>
#include <aztec_common/streaming.hpp>
#include <fstream>

void transform(size_t polynomial_degree)
{
  using Fr = libff::Fr<libff::alt_bn128_pp>;
  using Fq = libff::Fq<libff::alt_bn128_pp>;
  using G1 = libff::G1<libff::alt_bn128_pp>;
  using G2 = libff::G2<libff::alt_bn128_pp>;

  std::cout << "Loading data..." << std::endl;

  std::vector<Fr> generator_polynomial;
  std::vector<G1> g1_x(polynomial_degree);
  std::vector<G2> g2_x(polynomial_degree);
  streaming::Manifest manifest;

  streaming::read_field_elements_from_file(generator_polynomial, "../setup_db/generator.dat", polynomial_degree + 1);
  streaming::read_transcript<Fq>(g1_x, g2_x, manifest, "../setup_db/transcript.dat");
  g1_x.insert(g1_x.begin(), G1::one());

  std::cout << "Transforming..." << std::endl;

  Timer timer;

  {
    std::ofstream file("../setup_db/generator_prep.dat");
    file.write((char *)&generator_polynomial[0], generator_polynomial.size() * sizeof(Fr));
  }

  {
    std::ofstream file("../setup_db/g1_x_prep.dat");
    file.write((char *)&g1_x[0], g1_x.size() * sizeof(G1));
  }

  std::cout << "Transformed and written in " << timer.toString() << "s" << std::endl;
}

int main(int argc, char **argv)
{
  if (argc < 2)
  {
    std::cout << "usage: " << argv[0] << " <polynomials>" << std::endl;
    return 1;
  }
  const size_t polynomial_degree = strtol(argv[1], NULL, 0);

  libff::alt_bn128_pp::init_public_params();

  try
  {
    transform(polynomial_degree);
  }
  catch (char const *err)
  {
    std::cout << err << std::endl;
    return 1;
  }

  return 0;
}