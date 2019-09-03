#include "streaming_g1.hpp"
#include "streaming.hpp"
#include "compression.hpp"

namespace streaming
{

void write_g1_element_to_buffer(G1 const &element, char *buffer)
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

void write_g1_elements_to_buffer(std::vector<G1> const &elements, char *buffer)
{
    constexpr size_t bytes_per_element = USE_COMPRESSION ? sizeof(Fq) : sizeof(Fq) * 2;

    for (size_t i = 0; i < elements.size(); ++i)
    {
        size_t byte_position = bytes_per_element * i;
        write_g1_element_to_buffer(elements[i], buffer + byte_position);
    }
}

G1 read_g1_element_from_buffer(char *buffer)
{
    constexpr size_t num_limbs = sizeof(Fq) / GMP_NUMB_BYTES;

    libff::bigint<num_limbs> x;
    G1 element;

    //  = &elements[i].X;
    //  = &elements[i].Y;
    memcpy(&x, buffer, sizeof(Fq));
    if (isLittleEndian())
    {
        __bswap_bigint<num_limbs>(x);
    }
    if (USE_COMPRESSION)
    {
        element = compression::decompress<num_limbs, Fq, G1>(x);
        // TODO: something here
    }
    else
    {
        libff::bigint<num_limbs> y;
        memcpy(&y, &buffer[sizeof(Fq)], sizeof(Fq));
        if (isLittleEndian())
        {
            __bswap_bigint<num_limbs>(y);
        }
        element.X = Fq(x);
        element.Y = Fq(y);
        element.Z = Fq::one();

        if (!element.is_well_formed())
        {
            throw std::runtime_error("G1 points are not on the curve!");
        }
    }
    return element;
}

void read_g1_elements_from_buffer(std::vector<G1> &elements, char *buffer, size_t buffer_size)
{
    constexpr size_t bytes_per_element = USE_COMPRESSION ? sizeof(Fq) : sizeof(Fq) * 2;
    size_t num_elements = buffer_size / bytes_per_element;
    elements.reserve(elements.size() + num_elements);

    for (size_t i = 0; i < num_elements; ++i)
    {
        elements.push_back(read_g1_element_from_buffer(&buffer[i * bytes_per_element]));
    }
}

} // namespace streaming