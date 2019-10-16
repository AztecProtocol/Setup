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

namespace generate_h
{

G1 process_range(std::vector<G1> const &powers_of_x, std::vector<Fr> const &generator_coefficients, size_t start, size_t num)
{
    return libff::multi_exp<G1, Fr, libff::multi_exp_method_bos_coster>(
        powers_of_x.begin() + 1 + start,
        powers_of_x.begin() + 1 + start + num,
        generator_coefficients.begin() + 1 + start,
        generator_coefficients.begin() + 1 + start + num,
        1);
}

G1 batch_process_range(size_t batch_num, std::vector<G1> const &g1_x, std::vector<Fr> const &generator_polynomial)
{
    size_t polynomial_degree = g1_x.size() - 1;
    size_t batch_size = polynomial_degree / batch_num;
    size_t leftovers = polynomial_degree % batch_size;
    std::vector<size_t> batches(batch_num);
    std::iota(batches.begin(), batches.end(), 0);

    auto batch_process = [&](size_t i) {
        return process_range(g1_x, generator_polynomial, batch_size * i, (i == batch_num - 1) ? batch_size + leftovers : batch_size);
    };

    std::vector<G1> results;
    std::transform(batches.begin(), batches.end(), std::back_inserter(results), batch_process);
    return std::accumulate(results.begin(), results.end(), G1::zero());
}

void compute_h(std::string const &setup_db_path, std::string const &generator_path)
{
    Timer total_timer;

    std::cerr << "Loading data..." << std::endl;
    Timer data_timer;
    std::vector<Fr> generator_polynomial;
    std::vector<G1> g1_x = {G1::one()};
    streaming::read_transcripts_g1_points(g1_x, setup_db_path);
    streaming::read_field_elements_from_file(generator_polynomial, generator_path);

    std::cerr << "Loaded " << g1_x.size() << " points and " << generator_polynomial.size() << " coefficients in " << data_timer.toString() << "s" << std::endl;

    if (g1_x.size() != generator_polynomial.size())
    {
        throw std::runtime_error("g1_x and generator_polynomial size mismatch.");
    }

    Timer compute_timer;
    G1 result = batch_process_range(4, g1_x, generator_polynomial);
    std::cerr << "Compute time: " << compute_timer.toString() << "s" << std::endl;
    std::cerr << "Total time: " << total_timer.toString() << "s" << std::endl;

    result.to_affine_coordinates();
    gmp_printf("[\"0x%064Nx\",\"0x%064Nx\"]\n",
               result.X.as_bigint().data, 4L,
               result.Y.as_bigint().data, 4L);
}

} // namespace generate_h