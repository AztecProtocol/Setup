/**
 * Setup
 * Copyright Spilsbury Holdings 2019
 **/
#include "range_multi_exp.hpp"

#include <aztec_common/assert.hpp>
#include <aztec_common/streaming_transcript.hpp>
#include <aztec_common/timer.hpp>

#include <barretenberg/groups/scalar_multiplication.hpp>

#include <fcntl.h>
#include <unistd.h>
#include <sys/mman.h>
#include <sys/stat.h>

void *map_file(std::string const &filename)
{
    int fd = open(filename.c_str(), O_RDONLY);
    assert(fd != -1);

    struct stat sb;
    if (fstat(fd, &sb) != -1)
    {
        assert(false);
    }

    void *data = mmap(0, sb.st_size, PROT_READ, MAP_PRIVATE, fd, 0);
    assert(data != MAP_FAILED);
    close(fd);

    return data;
}

bb::g1::element process_range_zero(bb::g1::affine_element *const &powers_of_x, bb::fr::field_t *const &generator_coefficients, size_t start, size_t num)
{
    // Scalars are mutated, so copy them first.
    auto range_coefficients = std::vector<bb::fr::field_t>(num);
    memcpy(&range_coefficients[0], generator_coefficients + 1 + start, num * sizeof(bb::fr::field_t));
    return bb::scalar_multiplication::pippenger_low_memory(&range_coefficients[0], powers_of_x + start, num);
}

bb::g1::element process_range_single(int range_index, bb::fr::field_t &fa, bb::g1::affine_element *const &powers_of_x, bb::fr::field_t *const &generator_coefficients, size_t start, size_t num)
{
    std::vector<bb::fr::field_t> range_coefficients(num);

    bb::fr::field_t divisor;
    bb::fr::to_montgomery_form({(uint64_t)range_index, 0, 0, 0}, divisor);
    bb::fr::neg(divisor, divisor);
    divisor = bb::fr::invert(divisor);

    range_coefficients[0] = bb::fr::mul(bb::fr::sub(generator_coefficients[start], fa), divisor);
    for (size_t i = 1; i < num; ++i)
    {
        range_coefficients[i] = bb::fr::mul(bb::fr::sub(generator_coefficients[start + i], range_coefficients[i - 1]), divisor);
    }

    fa = range_coefficients.back();

    return bb::scalar_multiplication::pippenger_low_memory(&range_coefficients[0], powers_of_x + start, num);
}

bb::g1::element process_range(int range_index, bb::fr::field_t &fa, bb::g1::affine_element *const powers_of_x, bb::fr::field_t *const generator_coefficients, size_t start, size_t num)
{
    return range_index == 0
               ? process_range_zero(powers_of_x, generator_coefficients, start, num)
               : process_range_single(range_index, fa, powers_of_x, generator_coefficients, start, num);
}

bb::g1::element batch_process_range(size_t range_index, size_t polynomial_degree, size_t batch_num, bb::g1::affine_element *const &g1_x, bb::fr::field_t *const &generator_polynomial)
{
    size_t batch_size = polynomial_degree / batch_num;
    size_t leftovers = polynomial_degree % batch_size;
    bb::fr::field_t fa = bb::fr::zero();

    bb::g1::element result = {.x = {0}, .y = {0}, .z = {0}};
    bb::g1::set_infinity(result);
    for (size_t i = 0; i < batch_num; ++i)
    {
        auto r = process_range(range_index, fa, g1_x, generator_polynomial, batch_size * i, (i == batch_num - 1) ? batch_size + leftovers : batch_size);
        bb::g1::add(r, result, result);
    }

    return result;
}

void compute_range_polynomials(std::string const &generator_path, std::string const &g1x_path, size_t range_index, size_t polynomial_degree, size_t batches)
{
    Timer total_timer;

    std::cerr << "Loading data..." << std::endl;
    Timer data_timer;
    bb::fr::field_t *generator_coefficients = (bb::fr::field_t *)map_file(generator_path);
    bb::g1::affine_element *g1_x = (bb::g1::affine_element *)map_file(g1x_path);
    std::cerr << "Loaded in " << data_timer.toString() << "s" << std::endl;

    Timer compute_timer;
    bb::g1::element result = batch_process_range(range_index, polynomial_degree, batches, g1_x, generator_coefficients);

    std::cerr << "Compute time: " << compute_timer.toString() << "s" << std::endl;
    std::cerr << "Total time: " << total_timer.toString() << "s" << std::endl;

    bb::g1::affine_element r;
    bb::g1::jacobian_to_affine(result, r);
    bb::fq::from_montgomery_form(r.x, r.x);
    bb::fq::from_montgomery_form(r.y, r.y);
    gmp_printf("[\"0x%064Nx\",\"0x%064Nx\"]\n", r.x.data, 4L, r.y.data, 4L);
}
