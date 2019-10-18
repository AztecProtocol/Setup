#include <barretenberg/fields/fr.hpp>
#include <barretenberg/groups/g1.hpp>
#include <aztec_common/streaming_transcript.hpp>
#include <fstream>

namespace bb = barretenberg;

void transform_g1x(std::string const &setup_db_path, std::string const& output)
{
  std::ofstream file(output);
  G1 one = G1::one();
  one.to_affine_coordinates();
  file.write((char *)&one, sizeof(bb::g1::affine_element));

  size_t num = 0;
  std::string filename = streaming::getTranscriptInPath(setup_db_path, num);

  while (streaming::is_file_exist(filename))
  {
    std::cout << "Loading " << filename << "..." << std::endl;
    streaming::Manifest manifest;
    streaming::read_transcript_manifest(manifest, filename);
    std::vector<G1> g1_x;
    streaming::read_transcript_g1_points(g1_x, filename, 0, manifest.num_g1_points);

    // Transform to affine.
    std::vector<bb::g1::affine_element> bx(g1_x.size());
    for (size_t i = 0; i < g1_x.size(); ++i)
    {
      g1_x[i].to_affine_coordinates();
      memcpy(&bx[i], &g1_x[i], sizeof(bb::g1::affine_element));
    }

    std::cout << "Writing " << g1_x.size() << " points..." << std::endl;
    file.write((char *)&bx[0], bx.size() * sizeof(bb::g1::affine_element));

    filename = streaming::getTranscriptInPath(setup_db_path, ++num);
  }

  if (num == 0)
  {
    throw std::runtime_error("No input files found.");
  }

  std::cout << "Done." << std::endl;
}

int main(int argc, char **argv)
{
  if (argc != 3)
  {
    std::cout << "usage: " << argv[0] << " <setup db path> <output>" << std::endl;
    return 1;
  }
  const std::string setup_db_path = argv[1];
  const std::string output = argv[2];

  libff::alt_bn128_pp::init_public_params();

  try
  {
    transform_g1x(setup_db_path, output);
  }
  catch (std::exception const &err)
  {
    std::cout << err.what() << std::endl;
    return 1;
  }

  return 0;
}