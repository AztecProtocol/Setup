namespace streaming {

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

template <typename FieldT, typename GroupT>
void write_g1_elements_to_buffer(GroupT* elements, char* buffer, size_t degree)
{
    constexpr size_t bytes_per_element = USE_COMPRESSION ? sizeof(FieldT) : sizeof(FieldT) * 2;

    for (size_t i = 0; i < degree; ++i)
    {
        size_t byte_position = bytes_per_element * i;
        write_g1_element_to_buffer<GroupT>(elements[i], buffer + byte_position);
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
        memcpy(&x, &buffer[i * bytes_per_element], sizeof(FieldT));
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
            memcpy(&y, &buffer[sizeof(FieldT) + i * bytes_per_element], sizeof(FieldT));
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

}