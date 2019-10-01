#include "streaming_transcript.hpp"
#include "streaming.hpp"
#include "streaming_g1.hpp"
#include "streaming_g2.hpp"
#include <memory>
#include <arpa/inet.h>

namespace streaming
{

size_t get_transcript_size(Manifest const &manifest)
{
  const size_t manifest_size = sizeof(Manifest);
  const size_t g1_buffer_size = sizeof(Fq) * (USE_COMPRESSION ? 1 : 2) * manifest.num_g1_points;
  const size_t g2_buffer_size = sizeof(Fqe) * (USE_COMPRESSION ? 1 : 2) * manifest.num_g2_points;
  return manifest_size + g1_buffer_size + g2_buffer_size + checksum::BLAKE2B_CHECKSUM_LENGTH;
}

void read_manifest(std::vector<char> &buffer, Manifest &manifest)
{
  auto manifest_buf = (Manifest *)&buffer[0];
  std::copy(manifest_buf, manifest_buf + 1, &manifest);
  manifest.transcript_number = ntohl(manifest.transcript_number);
  manifest.total_transcripts = ntohl(manifest.total_transcripts);
  manifest.total_g1_points = ntohl(manifest.total_g1_points);
  manifest.total_g2_points = ntohl(manifest.total_g2_points);
  manifest.num_g1_points = ntohl(manifest.num_g1_points);
  manifest.num_g2_points = ntohl(manifest.num_g2_points);
  manifest.start_from = ntohl(manifest.start_from);
}

std::vector<char> read_checksum(std::string const &path)
{
  auto buffer = read_file_into_buffer(path);
  std::vector<char> checksum = validate_checksum(buffer);
  return checksum;
}

void read_transcript(std::vector<G1> &g1_x, std::vector<G2> &g2_x, Manifest &manifest, std::string const &path)
{
  auto buffer = read_file_into_buffer(path);
  validate_checksum(buffer);
  read_manifest(buffer, manifest);

  const size_t manifest_size = sizeof(Manifest);
  const size_t g1_buffer_size = sizeof(Fq) * (USE_COMPRESSION ? 1 : 2) * manifest.num_g1_points;
  const size_t g2_buffer_size = sizeof(Fqe) * (USE_COMPRESSION ? 1 : 2) * manifest.num_g2_points;

  read_g1_elements_from_buffer(g1_x, &buffer[manifest_size], g1_buffer_size);
  read_g2_elements_from_buffer(g2_x, &buffer[manifest_size + g1_buffer_size], g2_buffer_size);
}

void read_transcript_manifest(Manifest &manifest, std::string const &path)
{
  auto buffer = read_file_into_buffer(path, 0, sizeof(Manifest));
  read_manifest(buffer, manifest);
}

void read_transcript_g1_points(std::vector<G1> &g1_x, std::string const &path, int offset, size_t num)
{
  Manifest manifest;
  const size_t manifest_size = sizeof(Manifest);
  const size_t g1_size = sizeof(Fq) * (USE_COMPRESSION ? 1 : 2);

  read_transcript_manifest(manifest, path);

  offset = offset < 0 ? manifest.num_g1_points + offset : offset;

  if ((uint32_t)offset < manifest.num_g1_points)
  {
    num = std::min((size_t)manifest.num_g1_points - offset, num);
    auto g1_0_buffer = read_file_into_buffer(path, manifest_size + (g1_size * offset), g1_size * num);
    read_g1_elements_from_buffer(g1_x, &g1_0_buffer[0], g1_size * num);
  }
}

void read_transcript_g2_points(std::vector<G2> &g2_x, std::string const &path, int offset, size_t num)
{
  Manifest manifest;
  const size_t manifest_size = sizeof(Manifest);
  const size_t g1_size = sizeof(Fq) * (USE_COMPRESSION ? 1 : 2);
  const size_t g2_size = sizeof(Fqe) * (USE_COMPRESSION ? 1 : 2);

  read_transcript_manifest(manifest, path);

  offset = offset < 0 ? manifest.num_g2_points + offset : offset;

  if ((uint32_t)offset < manifest.num_g2_points)
  {
    num = std::min((size_t)manifest.num_g2_points - offset, num);
    auto g2_0_buffer = read_file_into_buffer(path, manifest_size + (g1_size * manifest.num_g1_points) + (g2_size * offset), g2_size * num);
    read_g2_elements_from_buffer(g2_x, &g2_0_buffer[0], g2_size * num);
  }
}

void write_transcript(std::vector<G1> const &g1_x, std::vector<G2> const &g2_x, Manifest const &manifest, std::string const &path)
{
  const size_t manifest_size = sizeof(Manifest);
  const size_t g1_buffer_size = sizeof(Fq) * (USE_COMPRESSION ? 1 : 2) * g1_x.size();
  const size_t g2_buffer_size = sizeof(Fqe) * (USE_COMPRESSION ? 1 : 2) * g2_x.size();
  const size_t transcript_size = manifest_size + g1_buffer_size + g2_buffer_size + checksum::BLAKE2B_CHECKSUM_LENGTH;
  std::vector<char> buffer(transcript_size);

  Manifest net_manifest;
  net_manifest.transcript_number = htonl(manifest.transcript_number);
  net_manifest.total_transcripts = htonl(manifest.total_transcripts);
  net_manifest.total_g1_points = htonl(manifest.total_g1_points);
  net_manifest.total_g2_points = htonl(manifest.total_g2_points);
  net_manifest.num_g1_points = htonl(manifest.num_g1_points);
  net_manifest.num_g2_points = htonl(manifest.num_g2_points);
  net_manifest.start_from = htonl(manifest.start_from);

  std::copy(&net_manifest, &net_manifest + 1, (Manifest *)&buffer[0]);

  write_g1_elements_to_buffer(g1_x, &buffer[manifest_size]);
  write_g2_elements_to_buffer(g2_x, &buffer[manifest_size + g1_buffer_size]);
  add_checksum_to_buffer(&buffer[0], manifest_size + g1_buffer_size + g2_buffer_size);
  write_buffer_to_file(path, buffer);
}

std::string getTranscriptInPath(std::string const &dir, size_t num)
{
  return dir + "/transcript" + std::to_string(num) + ".dat";
};

void read_transcripts_g1_points(std::vector<G1> &g1_x, std::string const &dir)
{
  streaming::Manifest manifest;

  size_t num = 0;
  std::string filename = getTranscriptInPath(dir, num);

  // Reserve additional space to store all the points.
  streaming::read_transcript_manifest(manifest, filename);
  g1_x.reserve(g1_x.size() + manifest.total_g1_points);

  while (streaming::is_file_exist(filename))
  {
    streaming::read_transcript_manifest(manifest, filename);
    streaming::read_transcript_g1_points(g1_x, filename, 0, manifest.num_g1_points);
    filename = getTranscriptInPath(dir, ++num);
  }

  if (num == 0)
  {
    throw std::runtime_error("No input files found.");
  }
}

} // namespace streaming