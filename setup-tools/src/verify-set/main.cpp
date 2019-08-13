/**
 * Setup
 * Copyright Spilsbury Holdings 2019
 **/
#include <aztec_common/streaming_transcript.hpp>

int main(int argc, char **argv)
{
    if (argc < 4)
    {
        std::cout << "usage: " << argv[0] << " <num g1 points> <num g2 points> <transcript 0 path> ... <transcript n path>" << std::endl;
        return 1;
    }

    try
    {
        size_t expected_g1_points = strtol(argv[1], NULL, 0);
        size_t expected_g2_points = strtol(argv[2], NULL, 0);

        size_t total_g1_points = 0;
        size_t total_g2_points = 0;
        for (int i = 3; i < argc; ++i)
        {
            streaming::Manifest manifest;
            std::string const transcript_path(argv[i]);
            streaming::read_transcript_manifest(manifest, transcript_path);

            if (manifest.total_g1_points != expected_g1_points)
            {
                throw std::runtime_error("Manifest contains wrong total number of G1 points.");
            }

            if (manifest.total_g2_points != expected_g2_points)
            {
                throw std::runtime_error("Manifest contains wrong total number of G2 points.");
            }

            total_g1_points += manifest.num_g1_points;
            total_g2_points += manifest.num_g2_points;
        }

        if (total_g1_points != expected_g1_points)
        {
            throw std::runtime_error("Manifests don't sum to expected total number of G1 points.");
        }

        // Minus one due to g2^y tacked on.
        if (total_g2_points - 1 != expected_g2_points)
        {
            throw std::runtime_error("Manifests don't sum to expected total number of G2 points.");
        }

        std::cout << "Transcripts valid." << std::endl;
        return 0;
    }
    catch (std::exception const &err)
    {
        std::cerr << err.what() << std::endl;
        return 1;
    }
}