#include <vector>
#include <memory>

namespace streaming
{

template <typename FieldT, typename G1, typename G2>
void read_transcript(std::vector<G1> &g1_x, std::vector<G2> &g2_x, std::string path)
{
  const size_t g1_buffer_size = sizeof(FieldT) * (USE_COMPRESSION ? 1 : 2) * g1_x.size();
  const size_t g2_buffer_size = sizeof(FieldT) * (USE_COMPRESSION ? 2 : 4) * g2_x.size();
  const size_t transcript_size = g1_buffer_size + g2_buffer_size + checksum::BLAKE2B_CHECKSUM_LENGTH;
  std::unique_ptr<char[]> read_buffer(new char[transcript_size]);

  std::cout << "Reading transcript..." << std::endl;
  streaming::read_file_into_buffer(path.c_str(), read_buffer.get(), transcript_size);
  streaming::validate_checksum(read_buffer.get(), g1_buffer_size + g2_buffer_size);

  streaming::read_g1_elements_from_buffer<FieldT, G1>(&g1_x[0], read_buffer.get(), g1_buffer_size);
  streaming::read_g2_elements_from_buffer<FieldT, G2>(&g2_x[0], read_buffer.get() + g1_buffer_size, g2_buffer_size);
}

template <typename FieldT, typename FieldQT, typename G1, typename G2>
void write_transcript(std::vector<G1> &g1_x, std::vector<G2> &g2_x, std::string path)
{
  const size_t g1_buffer_size = sizeof(FieldT) * (USE_COMPRESSION ? 1 : 2) * g1_x.size();
  const size_t g2_buffer_size = sizeof(FieldT) * (USE_COMPRESSION ? 2 : 4) * g2_x.size();
  const size_t transcript_size = g1_buffer_size + g2_buffer_size + checksum::BLAKE2B_CHECKSUM_LENGTH;
  std::unique_ptr<char[]> write_buffer(new char[transcript_size]);

  std::cout << "Writing transcript..." << std::endl;

  streaming::write_g1_elements_to_buffer<FieldT, G1>(&g1_x[0], write_buffer.get(), g1_x.size());
  streaming::write_g2_elements_to_buffer<FieldQT, G2>(&g2_x[0], write_buffer.get() + g1_buffer_size, g2_x.size());
  streaming::add_checksum_to_buffer(write_buffer.get(), g1_buffer_size + g2_buffer_size);
  streaming::write_buffer_to_file(path.c_str(), write_buffer.get(), transcript_size);
}

} // namespace streaming