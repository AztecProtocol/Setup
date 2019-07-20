namespace streaming {

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


// FieldT = fq2 field of G2
// GroupT = larger G2 group
template <typename FieldT, typename GroupT>
void write_g2_elements_to_buffer(GroupT* elements, char* buffer, size_t degree)
{
    constexpr size_t bytes_per_element = USE_COMPRESSION ? sizeof(FieldT) : sizeof(FieldT) * 2;

    for (size_t i = 0; i < degree; ++i)
    {
        size_t byte_position = bytes_per_element * i;
        write_g2_element_to_buffer<GroupT>(elements[i], buffer + byte_position);
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
            memcpy(&y0, &buffer[2 * sizeof(FieldT) + i * bytes_per_element], sizeof(FieldT));
            memcpy(&y1, &buffer[3 * sizeof(FieldT) + i * bytes_per_element], sizeof(FieldT));
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

}