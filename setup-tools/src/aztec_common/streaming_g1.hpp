#pragma once
#include "libff_types.hpp"

namespace streaming
{

void write_g1_element_to_buffer(G1 &element, char *buffer);

void read_g1_elements_from_buffer(std::vector<G1> &elements, char *buffer, size_t buffer_size);

void write_g1_elements_to_buffer(std::vector<G1> const &elements, char *buffer);

} // namespace streaming