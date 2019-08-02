#pragma once
#include "libff_types.hpp"

namespace streaming
{

void write_g2_element_to_buffer(G2 &element, char *buffer);

void read_g2_elements_from_buffer(std::vector<G2> &elements, char *buffer, size_t buffer_size);

void write_g2_elements_to_buffer(std::vector<G2> const &elements, char *buffer);

}