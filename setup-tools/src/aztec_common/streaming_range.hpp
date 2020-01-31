#pragma once
#include "./streaming.hpp"
#include "./streaming_g1.hpp"
#include <barretenberg/fields/fr.hpp>
#include <barretenberg/fields/fq.hpp>
#include <barretenberg/groups/g1.hpp>

#include "omp.h"

constexpr size_t POINTS_PER_RANGE_FILE = 1000;
constexpr size_t MAX_RANGE = 10000000;
namespace streaming
{
namespace bb = barretenberg;

bb::g1::affine_element decompress(const bb::fq::field_t& x_in)
{
    bb::fq::field_t uncompressed = x_in;
    bool y_bit_flag = (uncompressed.data[3] >> 63ULL) == 1ULL;
    // printf("y_bit_flag = %u \n", y_bit_flag ? 1 : 0);
    uncompressed.data[3] = uncompressed.data[3] & 0x7fffffffffffffffULL;
    bb::fq::field_t x;
    bb::fq::to_montgomery_form(uncompressed, x);
    bb::fq::field_t three{{ 3, 0, 0, 0}};
    bb::fq::to_montgomery_form(three, three);
    bb::fq::field_t yy;
    bb::fq::__sqr(x, yy);
    bb::fq::__mul(yy, x, yy);
    bb::fq::__add(yy, three, yy);
    bb::fq::field_t y;
    bb::fq::__sqrt(yy, y);

    bb::fq::field_t y_raw;
    bb::fq::from_montgomery_form(y, y_raw);

    bool is_odd = ((y_raw.data[0] & 1ULL) == 1ULL);
    if (is_odd != y_bit_flag)
    {
        bb::fq::neg(y, y);
    }
    bb::g1::affine_element result;
    result.x = x;
    result.y = y;
    return result;
}

bb::g1::affine_element read_bberg_element_from_buffer(char *buffer)
{
    bb::fq::field_t x;
    bb::fq::field_t x_buf;


    //  = &elements[i].X;
    //  = &elements[i].Y;
    memcpy(&x_buf, buffer, sizeof(bb::fq::field_t));

    if (isLittleEndian())
    {
        x.data[3] = __bswap_64(x_buf.data[0]);
        x.data[2] = __bswap_64(x_buf.data[1]);
        x.data[1] = __bswap_64(x_buf.data[2]);
        x.data[0] = __bswap_64(x_buf.data[3]);

        // __bswap_bigint<num_limbs>(x);
    }
    else
    {
        x.data[3] = (x_buf.data[0]);
        x.data[2] = (x_buf.data[1]);
        x.data[1] = (x_buf.data[2]);
        x.data[0] = (x_buf.data[3]);
    }

    bb::g1::affine_element element = decompress(x);
    if (!bb::g1::on_curve(element) || bb::g1::is_point_at_infinity(element)) {
        throw std::runtime_error("G1 points are not on the curve!");
    }
    return element;
}

void read_bberg_elements_to_file(bb::g1::affine_element* elements, char *buffer, size_t buffer_size, bool force_compression)
{
    const size_t bytes_per_element = sizeof(bb::fq::field_t);
    size_t num_elements = buffer_size / bytes_per_element;
    // elements.reserve(elements.size() + num_elements);
    for (size_t i = 0; i < num_elements; ++i)
    {
        elements[i] = read_bberg_element_from_buffer(&buffer[i * bytes_per_element]);
    }
}

void read_file(std::string range_path, std::vector<bb::g1::affine_element>& points)
{
    constexpr size_t num_files = (MAX_RANGE / POINTS_PER_RANGE_FILE) + 1;
    const size_t num_threads = omp_get_max_threads();
    const size_t files_per_thread = num_files / num_threads;
    const size_t leftovers = num_files - (files_per_thread * num_threads);
#pragma omp parallel for
    for (size_t j = 0; j < num_threads; ++j)
    {
        size_t start = (j * files_per_thread);
        size_t end = (j + 1) * files_per_thread;
        if (j == num_threads - 1)
        {
            end += leftovers;
        }
        for (size_t i = start; i < end; ++i)
        {
            if ((i % 100) == 0)
            {
                printf("i = %lu \n", i);
            }
            size_t g1_buffer_size = 32 * POINTS_PER_RANGE_FILE;
            if (i == num_files - 1)
            {
                g1_buffer_size = 32; // only 1 point here
            }
            std::string filename = range_path + "data" + std::to_string(i * POINTS_PER_RANGE_FILE) + ".dat";
            //  std::cout << "filename = " << filename << std::endl;
            auto buffer = read_file_into_buffer(filename);
            read_bberg_elements_to_file(&points[i * POINTS_PER_RANGE_FILE], &buffer[0], g1_buffer_size, true);
        }
    }
    // for (size_t i = 0; i < num_files; ++i)
    // {
    //     if (i % 100 == 0)
    //     {
    //         printf("i = %lu \n", i);
    //     }
    //     // printf("points size = %lu \n", points.size());
    // }
}
}

// 0x0118c4d5b837bcc2bc89b5b398b5974e9f5944073b32078b7e231fec938883b0
// 0x0118c4d5b837bcc2bc89b5b398b5974e9f5944073b32078b7e231fec938883b0

// 0x260e01b251f6f1c7e7ff4e580791dee8ea51d87a358e038b4efe30fac09383c1
// 0x260e01b251f6f1c7e7ff4e580791dee8ea51d87a358e038b4efe30fac09383c1

// 0x22febda3c0c0632a11e6dd3f96e6cea211e6dd3f96e6cea2854a87d4dacc5e55
// 0x22febda3c0c0632a56475b4214e5615e11e6dd3f96e6cea2854a87d4dacc5e55

// 0x04fc6369f7110fe3d25156c1bb9a72859cf2a04641f99ba4ee413c80da6a5fe4
// 0x04fc6369f7110fe3d25156c1bb9a7285ee413c80da6a5fe4ee413c80da6a5fe4