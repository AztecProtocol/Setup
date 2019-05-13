#include <gmp.h>
#include <memory.h>
#include <fstream>
#include <vector>

constexpr int GMP_NUMB_BYTES = GMP_NUMB_BITS / 8;

namespace streaming
{
    template <typename FieldT>
    void write_element_to_buffer(FieldT& element, char* buffer);

    template <typename FieldT>
    void write_coefficients_to_file(std::vector<FieldT>& coefficients, const char* filename);
        
    template <typename GroupT>
    void write_group_element_to_buffer(GroupT& element, char* buffer);

    template <typename FieldT, typename GroupT>
    void write_group_elements_to_file(std::vector<GroupT>& elements, const char *filename);

    template <typename FieldT>
    void read_coefficients_from_file(std::vector<FieldT>& coefficients, const char* filename, size_t degree);
}
#include "streaming.tcc"