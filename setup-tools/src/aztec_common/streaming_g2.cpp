#include "streaming_g2.hpp"
#include "streaming.hpp"

namespace streaming
{

void write_g2_element_to_buffer(G2 const &element, char *buffer)
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

void write_g2_elements_to_buffer(std::vector<G2> const &elements, char *buffer)
{
    constexpr size_t bytes_per_element = USE_COMPRESSION ? sizeof(Fqe) : sizeof(Fqe) * 2;

    for (size_t i = 0; i < elements.size(); ++i)
    {
        size_t byte_position = bytes_per_element * i;
        write_g2_element_to_buffer(elements[i], buffer + byte_position);
    }
}

G2 read_g2_element_from_buffer(char *buffer)
{
    constexpr size_t num_limbs = sizeof(Fq) / GMP_NUMB_BYTES;
    G2 element;
    libff::bigint<num_limbs> x0;
    libff::bigint<num_limbs> x1;

    //  = &elements[i].X;
    //  = &elements[i].Y;
    memcpy(&x0, buffer, sizeof(Fq));
    memcpy(&x1, &buffer[sizeof(Fq)], sizeof(Fq));

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
        memcpy(&y0, &buffer[2 * sizeof(Fq)], sizeof(Fq));
        memcpy(&y1, &buffer[3 * sizeof(Fq)], sizeof(Fq));
        if (isLittleEndian())
        {
            __bswap_bigint<num_limbs>(y0);
            __bswap_bigint<num_limbs>(y1);
        }
        element.X.c0 = Fq(x0);
        element.X.c1 = Fq(x1);
        element.Y.c0 = Fq(y0);
        element.Y.c1 = Fq(y1);
        element.Z.c0 = Fq::one();
        element.Z.c1 = Fq::zero();
        if (!element.is_well_formed())
        {
            throw std::runtime_error("G2 points are not on the curve!");
        }
    }
    return element;
}

void read_g2_elements_from_buffer(std::vector<G2> &elements, char *buffer, size_t buffer_size)
{
    constexpr size_t bytes_per_element = USE_COMPRESSION ? sizeof(Fqe) : sizeof(Fqe) * 2;
    size_t num_elements = buffer_size / bytes_per_element;

    elements.reserve(elements.size() + num_elements);

    for (size_t i = 0; i < num_elements; ++i)
    {
        elements.push_back(read_g2_element_from_buffer(&buffer[i * bytes_per_element]));
    }
}

} // namespace streaming