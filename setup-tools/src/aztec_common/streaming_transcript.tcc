#include <vector>
#include <memory>
#include <arpa/inet.h>

namespace streaming
{

struct Manifest
{
  uint32_t transcript_number;
  uint32_t total_transcripts;
  uint32_t total_points;
  uint32_t num_points;
  uint32_t start_from;
};

template <typename FieldT, typename G1, typename G2>
size_t get_transcript_size(size_t num)
{
  const size_t manifest_size = sizeof(Manifest);
  const size_t g1_buffer_size = sizeof(FieldT) * (USE_COMPRESSION ? 1 : 2) * num;
  const size_t g2_buffer_size = sizeof(FieldT) * (USE_COMPRESSION ? 2 : 4) * num;
  return manifest_size + g1_buffer_size + g2_buffer_size + checksum::BLAKE2B_CHECKSUM_LENGTH;
}

template <typename FieldT, typename G1, typename G2>
void read_transcript(std::vector<G1> &g1_x, std::vector<G2> &g2_x, Manifest &manifest, std::string const &path)
{
  auto buffer = streaming::read_file_into_buffer(path);
  streaming::validate_checksum(buffer);

  auto manifest_buf = (Manifest *)&buffer[0];
  std::copy(manifest_buf, manifest_buf + 1, &manifest);
  manifest.transcript_number = ntohl(manifest.transcript_number);
  manifest.total_transcripts = ntohl(manifest.total_transcripts);
  manifest.total_points = ntohl(manifest.total_points);
  manifest.num_points = ntohl(manifest.num_points);
  manifest.start_from = ntohl(manifest.start_from);

  g1_x.resize(manifest.num_points);
  g2_x.resize(manifest.num_points);

  const size_t manifest_size = sizeof(Manifest);
  const size_t g1_buffer_size = sizeof(FieldT) * (USE_COMPRESSION ? 1 : 2) * manifest.num_points;
  const size_t g2_buffer_size = sizeof(FieldT) * (USE_COMPRESSION ? 2 : 4) * manifest.num_points;

  streaming::read_g1_elements_from_buffer<FieldT, G1>(&g1_x[0], &buffer[manifest_size], g1_buffer_size);
  streaming::read_g2_elements_from_buffer<FieldT, G2>(&g2_x[0], &buffer[manifest_size + g1_buffer_size], g2_buffer_size);
}

template <typename FieldT, typename FieldQT, typename G1, typename G2>
void write_transcript(std::vector<G1> &g1_x, std::vector<G2> &g2_x, Manifest const &manifest, std::string const &path)
{
  const size_t manifest_size = sizeof(Manifest);
  const size_t g1_buffer_size = sizeof(FieldT) * (USE_COMPRESSION ? 1 : 2) * g1_x.size();
  const size_t g2_buffer_size = sizeof(FieldT) * (USE_COMPRESSION ? 2 : 4) * g2_x.size();
  const size_t transcript_size = manifest_size + g1_buffer_size + g2_buffer_size + checksum::BLAKE2B_CHECKSUM_LENGTH;
  std::vector<char> buffer(transcript_size);

  Manifest net_manifest;
  net_manifest.transcript_number = htonl(manifest.transcript_number);
  net_manifest.total_transcripts = htonl(manifest.total_transcripts);
  net_manifest.total_points = htonl(manifest.total_points);
  net_manifest.num_points = htonl(manifest.num_points);
  net_manifest.start_from = htonl(manifest.start_from);

  std::copy(&net_manifest, &net_manifest + 1, (Manifest *)&buffer[0]);

  streaming::write_g1_elements_to_buffer<FieldT, G1>(&g1_x[0], &buffer[manifest_size], g1_x.size());
  streaming::write_g2_elements_to_buffer<FieldQT, G2>(&g2_x[0], &buffer[manifest_size + g1_buffer_size], g2_x.size());
  streaming::add_checksum_to_buffer(&buffer[0], manifest_size + g1_buffer_size + g2_buffer_size);
  streaming::write_buffer_to_file(path, buffer);
}

} // namespace streaming