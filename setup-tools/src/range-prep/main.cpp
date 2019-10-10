#include <aztec_common/streaming_transcript.hpp>
#include <fstream>

void transform_g1x(std::string const &setup_db_path)
{
  std::cout << "Loading data..." << std::endl;
  std::vector<G1> g1_x = {G1::one()};
  streaming::read_transcripts_g1_points(g1_x, setup_db_path);

  std::cout << "Writing..." << std::endl;
  std::ofstream file(setup_db_path + "/g1_x_prep.dat");
  file.write((char *)&g1_x[0], g1_x.size() * sizeof(G1));

  std::cout << "Done." << std::endl;
}

void transform_generator(std::string const &setup_db_path)
{
  std::cout << "Loading data..." << std::endl;
  std::vector<Fr> generator_polynomial;
  streaming::read_field_elements_from_file(generator_polynomial, setup_db_path + "/generator.dat");

  std::cout << "Writing..." << std::endl;
  std::ofstream file(setup_db_path + "/generator_prep.dat");
  file.write((char *)&generator_polynomial[0], generator_polynomial.size() * sizeof(Fr));

  std::cout << "Done." << std::endl;
}

int main(int argc, char **argv)
{
  if (argc != 3)
  {
    std::cout << "usage: " << argv[0] << " <setup db path> <g1x | generator>" << std::endl;
    return 1;
  }
  const std::string setup_db_path = argv[1];
  const std::string what = argv[2];

  libff::alt_bn128_pp::init_public_params();

  try
  {
    if (what == "g1x")
    {
      transform_g1x(setup_db_path);
    }
    else if (what == "generator")
    {
      transform_generator(setup_db_path);
    }
  }
  catch (std::exception const &err)
  {
    std::cout << err.what() << std::endl;
    return 1;
  }

  return 0;
}