#pragma once
#include "streaming.hpp"

constexpr size_t POINTS_PER_TRANSCRIPT = 10000000;

namespace streaming
{

struct Manifest
{
  uint32_t transcript_number;
  uint32_t total_transcripts;
  uint32_t total_g1_points;
  uint32_t total_g2_points;
  uint32_t num_g1_points;
  uint32_t num_g2_points;
  uint32_t start_from;
};

size_t get_transcript_size(Manifest const &manifest);

void read_manifest(std::vector<char> &buffer, Manifest &manifest);

std::vector<char> read_checksum(std::string const &path);

void read_transcript(std::vector<G1> &g1_x, std::vector<G2> &g2_x, Manifest &manifest, std::string const &path);

void read_transcript_manifest(Manifest &manifest, std::string const &path);

void read_transcript_g1_points(std::vector<G1> &g1_x, std::string const &path, int offset, size_t num);

void read_transcript_g2_points(std::vector<G2> &g2_x, std::string const &path, int offset, size_t num);

void write_transcript(std::vector<G1> const &g1_x, std::vector<G2> const &g2_x, Manifest const &manifest, std::string const &path);

} // namespace streaming