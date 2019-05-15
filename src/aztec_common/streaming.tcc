#include <gmp.h>
#include <memory.h>
#include <fstream>
#include <vector>

#include <iostream>

#include "compression.hpp"

namespace streaming
{
namespace
{
constexpr bool USE_COMPRESSION = false;
// static constexpr size_t BYTES_PER_LIMB = sizeof(mp_limb_t) >> 3;
constexpr int GMP_NUMB_BYTES = GMP_NUMB_BITS / 8;

bool isLittleEndian()
{
    int num = 42;
    return (*(char *)&num == 42);
}

template <size_t N>
void __bswap_bigint(libff::bigint<N>& val)
{
    for (size_t i = 0; i < N; ++i)
    {
        val.data[i] = __bswap_64(val.data[i]);
    }
}
} // namespace

template <size_t N>
void write_bigint_to_buffer(libff::bigint<N>& value, char* buffer)
{
    mp_limb_t temp;
    for (size_t i = 0; i < N; ++i)
    {
        if (isLittleEndian())
        {
            temp = __builtin_bswap64(value.data[i]);
        }
        memcpy(buffer + (i * GMP_NUMB_BYTES), &temp, GMP_NUMB_BYTES);
    }
}

template <typename FieldT>
void write_fq_to_buffer(FieldT& element, char* buffer)
{
    constexpr size_t num_limbs = sizeof(FieldT) / GMP_NUMB_BYTES;
    libff::bigint<num_limbs> value = element.as_bigint();
    write_bigint_to_buffer<num_limbs>(value, buffer);
}

/*! \brief compress a G1 element and write to buffer
 *
 */
template <typename GroupT>
void write_g1_element_to_buffer(GroupT& element, char* buffer)
{
    constexpr size_t num_limbs = sizeof(element.X) / GMP_NUMB_BYTES;
    libff::bigint<num_limbs> x = element.X.as_bigint();
    libff::bigint<num_limbs> y = element.Y.as_bigint();
    if (USE_COMPRESSION)
    {
        mp_limb_t set = ((mp_limb_t)y.test_bit(0)) << (GMP_NUMB_BITS - 1);
        x.data[x.N - 1] = x.data[x.N - 1] | set;
        write_bigint_to_buffer<num_limbs>(x, buffer);
    }
    else
    {
        write_bigint_to_buffer<num_limbs>(x, buffer);
        write_bigint_to_buffer<num_limbs>(y, buffer + (num_limbs * GMP_NUMB_BYTES));
    }
}

/*! \brief compress a G1 element and write to buffer
 *
 */
template <typename GroupT>
void write_g2_element_to_buffer(GroupT& element, char* buffer)
{
    constexpr size_t num_limbs = sizeof(element.X.c0) / GMP_NUMB_BYTES;

    libff::bigint<num_limbs> x0 = element.X.c0.as_bigint();
    libff::bigint<num_limbs> x1 = element.X.c1.as_bigint();
    libff::bigint<num_limbs> y0 = element.Y.c0.as_bigint();
    if (USE_COMPRESSION)
    {
        mp_limb_t set = ((mp_limb_t)y0.test_bit(0)) << (GMP_NUMB_BITS - 1);
        x1.data[x1.N - 1] = x1.data[x1.N - 1] | set;
        write_bigint_to_buffer<num_limbs>(x0, buffer);
        write_bigint_to_buffer<num_limbs>(x1, buffer + (num_limbs * GMP_NUMB_BYTES));
    }
    else
    {
        libff::bigint<num_limbs> y1 = element.Y.c1.as_bigint();
        write_bigint_to_buffer<num_limbs>(x0, buffer);
        write_bigint_to_buffer<num_limbs>(x1, buffer + (num_limbs * GMP_NUMB_BYTES));
        write_bigint_to_buffer<num_limbs>(y0, buffer + (num_limbs * GMP_NUMB_BYTES * 2));
        write_bigint_to_buffer<num_limbs>(y1, buffer + (num_limbs * GMP_NUMB_BYTES * 3));
    }
}


template <typename FieldT, typename GroupT>
void write_g1_elements_to_buffer(std::vector<GroupT>& elements, char* buffer)
{
    constexpr size_t bytes_per_element = USE_COMPRESSION ? sizeof(FieldT) : sizeof(FieldT) * 2;

    for (size_t i = 0; i < elements.size(); ++i)
    {
        size_t byte_position = bytes_per_element * i;
        write_g1_element_to_buffer<GroupT>(elements[i], buffer + byte_position);
    }
}

// FieldT = fq2 field of G2
// GroupT = larger G2 group
template <typename FieldT, typename GroupT>
void write_g2_elements_to_buffer(std::vector<GroupT>& elements, char* buffer)
{
    constexpr size_t bytes_per_element = USE_COMPRESSION ? sizeof(FieldT) : sizeof(FieldT) * 2;

    for (size_t i = 0; i < elements.size(); ++i)
    {
        size_t byte_position = bytes_per_element * i;
        write_g2_element_to_buffer<GroupT>(elements[i], buffer + byte_position);
    }
}

template <typename FieldT>
void write_field_elements_to_file(std::vector<FieldT> &coefficients, const char *filename)
{
    constexpr size_t bytes_per_element = sizeof(FieldT);
    // const size_t bytes_per_element = (bits_per_element >> 3) + ((bits_per_element & 0x7) > 0 ? 1 : 0);
    const size_t num_bytes = coefficients.size() * bytes_per_element;

    char *p = new char[num_bytes];
    for (size_t i = 0; i < coefficients.size(); ++i)
    {
        size_t byte_position = bytes_per_element * i;
        write_fq_to_buffer(coefficients[i], p + byte_position);
    }
    std::ofstream file;
    file.open(filename);
    file.write(p, num_bytes);
    file.close();
}

template <typename FieldT>
void read_field_elements_from_file(std::vector<FieldT> &coefficients, const char *filename, size_t degree)
{
    constexpr size_t bytes_per_element = sizeof(FieldT);
    constexpr size_t num_limbs = sizeof(FieldT) / GMP_NUMB_BYTES;
    const size_t length = (degree + 1) * bytes_per_element;

    std::vector<uint8_t> buffer;
    buffer.reserve(length);

    std::ifstream file;
    file.open(filename, std::ifstream::binary);
    file.read((char *)&*buffer.begin(), length);
    file.close();

    FieldT element;
    auto element_bigint = element.as_bigint();
    coefficients.reserve(degree + 1);
    for (size_t i = 0; i < length; i += bytes_per_element)
    {
        mp_limb_t *element_ptr = (mp_limb_t *)((char *)(&*buffer.begin()) + i);
        for (size_t j = 0; j < num_limbs; ++j)
        {
            mp_limb_t limb = element_ptr[j];
            if (isLittleEndian())
            {
                limb = __builtin_bswap64(limb);
            }
            element_bigint.data[j] = limb;
        }
        coefficients.emplace_back(FieldT(element_bigint));
    }
}

template <typename FieldT, typename GroupT>
void read_g1_elements_from_buffer(GroupT* elements, char* buffer, size_t buffer_size)
{
    constexpr size_t bytes_per_element = USE_COMPRESSION ? sizeof(FieldT) : sizeof(FieldT) * 2;
    constexpr size_t num_limbs = sizeof(FieldT) / GMP_NUMB_BYTES;
    size_t num_elements = buffer_size / bytes_per_element;

    libff::bigint<num_limbs> x;

    for (size_t i = 0; i < num_elements; ++i)
    {
        //  = &elements[i].X;
        //  = &elements[i].Y;
        memcpy(&x, &buffer[i * bytes_per_element], bytes_per_element);
        if (isLittleEndian())
        {
            __bswap_bigint<num_limbs>(x);
        }
        if (USE_COMPRESSION)
        {
            elements[i] = compression::decompress<num_limbs, FieldT, GroupT>(x);
            // TODO: something here
        }
        else
        {
            libff::bigint<num_limbs> y;
            memcpy(&y, &buffer[sizeof(FieldT) + i * bytes_per_element], bytes_per_element);
            if (isLittleEndian())
            {
                __bswap_bigint<num_limbs>(y);
            }
            elements[i].X = FieldT(x);
            elements[i].Y = FieldT(y);
            elements[i].Z = FieldT::one();
        }
    }
}

// FieldT = field element in small G1 group
// GroupT = G2 group
template <typename FieldT, typename GroupT>
void read_g2_elements_from_buffer(GroupT* elements, char* buffer, size_t buffer_size)
{
    constexpr size_t bytes_per_element = USE_COMPRESSION ? sizeof(FieldT) * 2 : sizeof(FieldT) * 4;
    constexpr size_t num_limbs = sizeof(FieldT) / GMP_NUMB_BYTES;
    size_t num_elements = buffer_size / bytes_per_element;

    libff::bigint<num_limbs> x0;
    libff::bigint<num_limbs> x1;

    for (size_t i = 0; i < num_elements; ++i)
    {
        //  = &elements[i].X;
        //  = &elements[i].Y;
        memcpy(&x0, &buffer[i * bytes_per_element], sizeof(FieldT));
        memcpy(&x1, &buffer[sizeof(FieldT) + i * bytes_per_element], sizeof(FieldT));

        if (isLittleEndian())
        {
            __bswap_bigint<num_limbs>(x0);
            __bswap_bigint<num_limbs>(x1);
        }
        if (USE_COMPRESSION)
        {
            // elements[i] = compression::decompress<num_limbs, FieldT, GroupT>(x);
            // TODO: something here
        }
        else
        {
            libff::bigint<num_limbs> y0;
            libff::bigint<num_limbs> y1;
            memcpy(&y0, &buffer[2 * sizeof(FieldT) + i * bytes_per_element], bytes_per_element);
            memcpy(&y1, &buffer[3 * sizeof(FieldT) + i * bytes_per_element], bytes_per_element);
            if (isLittleEndian())
            {
                __bswap_bigint<num_limbs>(y0);
                __bswap_bigint<num_limbs>(y1);
            }
            elements[i].X.c0 = FieldT(x0);
            elements[i].X.c1 = FieldT(x1);
            elements[i].Y.c0 = FieldT(y0);
            elements[i].Y.c1 = FieldT(y1);
            elements[i].Z.c0 = FieldT::one();
            elements[i].Z.c1 = FieldT::zero();
        }
    }
}
} // namespace streaming