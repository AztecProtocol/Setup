/**
 * Setup
 * Copyright Spilsbury Holdings 2019
 **/
#include "range_multi_exp.hpp"

#include <aztec_common/assert.hpp>
#include <aztec_common/streaming_transcript.hpp>
#include <aztec_common/timer.hpp>

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

G1 process_range_zero(G1 *const &powers_of_x, Fr *const &generator_coefficients, size_t start, size_t num)
{
    G1 *a = powers_of_x + start;
    G1 *b = powers_of_x + start + num;
    Fr *c = generator_coefficients + 1 + start;
    Fr *d = generator_coefficients + 1 + start + num;
    return libff::multi_exp<G1, Fr, libff::multi_exp_method_bos_coster>(
        *reinterpret_cast<std::vector<G1>::const_iterator *>(&a),
        *reinterpret_cast<std::vector<G1>::const_iterator *>(&b),
        *reinterpret_cast<std::vector<Fr>::const_iterator *>(&c),
        *reinterpret_cast<std::vector<Fr>::const_iterator *>(&d),
        1);
}

G1 process_range_single(int range_index, Fr &fa, G1 *const &powers_of_x, Fr *const &generator_coefficients, size_t start, size_t num)
{
    std::vector<Fr> range_coefficients(num);
    Fr divisor = (-Fr(range_index)).inverse();

    range_coefficients[0] = (generator_coefficients[start] - fa) * divisor;
    for (size_t i = 1; i < num; ++i)
    {
        range_coefficients[i] = (generator_coefficients[start + i] - range_coefficients[i - 1]) * divisor;
    }

    G1 *a = powers_of_x + start;
    G1 *b = powers_of_x + start + num;
    G1 multiexp_result = libff::multi_exp<G1, Fr, libff::multi_exp_method_bos_coster>(
        *reinterpret_cast<std::vector<G1>::const_iterator *>(&a),
        *reinterpret_cast<std::vector<G1>::const_iterator *>(&b),
        range_coefficients.cbegin(),
        range_coefficients.cend(),
        1);

    fa = range_coefficients.back();

    return multiexp_result;
}

G1 process_range(int range_index, Fr &fa, G1 *const powers_of_x, Fr *const generator_coefficients, size_t start, size_t num)
{
    return range_index == 0
               ? process_range_zero(powers_of_x, generator_coefficients, start, num)
               : process_range_single(range_index, fa, powers_of_x, generator_coefficients, start, num);
}

void compute_range_polynomials(int range_index, size_t polynomial_degree)
{
    Timer total_timer;

    std::cerr << "Loading data..." << std::endl;
    Timer data_timer;
    Fr *generator_polynomial = (Fr *)map_file("../setup_db/generator_prep.dat");
    G1 *g1_x = (G1 *)map_file("../setup_db/g1_x_prep.dat");
    std::cerr << "Loaded in " << data_timer.toString() << "s" << std::endl;

    size_t batch_num = 4;
    size_t batch_size = polynomial_degree / batch_num;
    size_t leftovers = polynomial_degree % batch_size;
    std::vector<size_t> batches(batch_num);
    std::iota(batches.begin(), batches.end(), 0);
    Fr fa = Fr::zero();

    auto batch_process = [&](int i) {
        batch_size += (i == batch_num - 1) ? leftovers : 0;
        return process_range(range_index, fa, g1_x, generator_polynomial, batch_size * i, batch_size);
    };

    Timer compute_timer;
    std::vector<G1> results;
    std::transform(batches.begin(), batches.end(), std::back_inserter(results), batch_process);
    G1 result = std::accumulate(results.begin(), results.end(), G1::zero());

    std::cerr << "Compute time: " << compute_timer.toString() << "s" << std::endl;
    std::cerr << "Total time: " << total_timer.toString() << "s" << std::endl;

    result.print();
}
