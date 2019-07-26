#include <vector>
#include <memory>

namespace streaming
{

template <typename FieldT, typename G1, typename G2>
void read_transcript(std::vector<G1> &g1_x, std::vector<G2> &g2_x, size_t &start_from, std::string const &path)
{
  auto buffer = streaming::read_file_into_buffer(path);
  streaming::validate_checksum(buffer);

  const int32_t num = read_int32_t(&buffer[0]);
  start_from = read_int32_t(&buffer[sizeof(int32_t)]);

  g1_x.resize(num);
  g2_x.resize(num);

  const size_t prefix_size = 2 * sizeof(int32_t);
  const size_t g1_buffer_size = sizeof(FieldT) * (USE_COMPRESSION ? 1 : 2) * num;
  const size_t g2_buffer_size = sizeof(FieldT) * (USE_COMPRESSION ? 2 : 4) * num;

  streaming::read_g1_elements_from_buffer<FieldT, G1>(&g1_x[0], &buffer[prefix_size], g1_buffer_size);
  streaming::read_g2_elements_from_buffer<FieldT, G2>(&g2_x[0], &buffer[prefix_size + g1_buffer_size], g2_buffer_size);
}

template <typename FieldT, typename FieldQT, typename G1, typename G2>
void write_transcript(std::vector<G1> &g1_x, std::vector<G2> &g2_x, size_t start_from, std::string const &path)
{
  const size_t prefix_size = 2 * sizeof(int32_t);
  const size_t g1_buffer_size = sizeof(FieldT) * (USE_COMPRESSION ? 1 : 2) * g1_x.size();
  const size_t g2_buffer_size = sizeof(FieldT) * (USE_COMPRESSION ? 2 : 4) * g2_x.size();
  const size_t transcript_size = prefix_size + g1_buffer_size + g2_buffer_size + checksum::BLAKE2B_CHECKSUM_LENGTH;
  std::vector<char> buffer(transcript_size);

  write_int32_t(&buffer[0], (int32_t)g1_x.size());
  write_int32_t(&buffer[sizeof(int32_t)], (int32_t)start_from);

  streaming::write_g1_elements_to_buffer<FieldT, G1>(&g1_x[0], &buffer[prefix_size], g1_x.size());
  streaming::write_g2_elements_to_buffer<FieldQT, G2>(&g2_x[0], &buffer[prefix_size + g1_buffer_size], g2_x.size());
  streaming::add_checksum_to_buffer(&buffer[0], prefix_size + g1_buffer_size + g2_buffer_size);
  streaming::write_buffer_to_file(path, buffer);
}

} // namespace streaming