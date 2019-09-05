/**
 * Setup
 * Copyright Spilsbury Holdings 2019
 **/
#include "verifier.hpp"

int main(int argc, char **argv)
{
    if (argc < 6)
    {
        std::cout << "usage: " << argv[0] << " <total G1 points> <total G2 points> <points per transcript> <transcript num> <transcript path> [<transcript 0 path> <previous transcript path>]" << std::endl;
        return 1;
    }
    size_t const total_g1_points = strtol(argv[1], NULL, 0);
    size_t const total_g2_points = strtol(argv[2], NULL, 0);
    size_t const points_per_transcript = strtol(argv[3], NULL, 0);
    size_t const transcript_num = strtol(argv[4], NULL, 0);
    std::string const transcript_path(argv[5]);
    std::string const transcript0_path(argc == 6 ? argv[5] : argv[6]);
    std::string const transcript_previous_path(argc > 7 ? argv[7] : "");

    libff::alt_bn128_pp::init_public_params();

    if (!streaming::is_file_exist(transcript_path))
    {
        std::cout << "Transcript not found: " << transcript_path << std::endl;
        return 1;
    }
    if (!streaming::is_file_exist(transcript0_path))
    {
        std::cout << "Transcript 0 not found: " << transcript0_path << std::endl;
        return 1;
    }
    if (!transcript_previous_path.empty() && !streaming::is_file_exist(transcript_previous_path))
    {
        std::cout << "Previous transcript not found: " << transcript_previous_path << std::endl;
        return 1;
    }

    try
    {
        streaming::Manifest manifest;
        std::vector<G1> g1_x;
        std::vector<G2> g2_x;
        std::vector<G1> g1_0_0;
        std::vector<G2> g2_0_0;
        std::vector<G1> g1_x_previous;
        std::vector<G2> g2_y;

        // Read first points from transcript 0.
        streaming::read_transcript_g1_points(g1_0_0, transcript0_path, 0, 1);
        streaming::read_transcript_g2_points(g2_0_0, transcript0_path, 0, 1);

        if (!g1_0_0.size() || !g2_0_0.size())
        {
            throw std::runtime_error("Missing either G1 or G2 zero point.");
        }

        streaming::read_transcript_manifest(manifest, transcript_path);
        validate_manifest(manifest, total_g1_points, total_g2_points, points_per_transcript, transcript_num);

        if (manifest.transcript_number == 0)
        {
            // If we are transcript 0 we need to add the generator point to the beginning of the series.
            // This allows validating a single point as there will be at least 2 in the series.
            g1_x.push_back(G1::one());
            g2_x.push_back(G2::one());
        }

        if (transcript_previous_path.empty())
        {
            // First participant, first transcript. Discard our g2^y point.
            if (manifest.transcript_number != 0)
            {
                throw std::runtime_error("Must provide a previous transcript if not transcript 0.");
            }
            streaming::read_transcript(g1_x, g2_x, manifest, transcript_path);
            g2_x.pop_back();
        }
        else
        {
            streaming::Manifest previous_manifest;
            streaming::read_transcript_manifest(previous_manifest, transcript_previous_path);

            // If this transcript and previous transcript are 0, we are going to check this transcript was built
            // on top of the previous participants using the g2^y and previous g1_x points.
            if (manifest.transcript_number == 0 && previous_manifest.transcript_number == 0)
            {
                streaming::read_transcript_g1_points(g1_x_previous, transcript_previous_path, 0, 1);
                streaming::read_transcript(g1_x, g2_x, manifest, transcript_path);
                // Extract g2_y point from this transcript.
                g2_y.push_back(g2_x.back());
                g2_x.pop_back();
            }
            else
            {
                // Read the last points from the previous transcript to validate the sequence.
                // Second to last g2 point if the previous transcript is 0, due to g2^y being tacked on.
                streaming::read_transcript_g1_points(g1_x, transcript_previous_path, -1, 1);
                size_t from_g2_end = previous_manifest.transcript_number == 0 ? -2 : -1;
                streaming::read_transcript_g2_points(g2_x, transcript_previous_path, from_g2_end, 1);
                streaming::read_transcript(g1_x, g2_x, manifest, transcript_path);
            }
        }

        std::cout << "Verifying..." << std::endl;
        validate_transcript(g1_0_0[0], g2_0_0[0], g1_x, g2_x, g1_x_previous, g2_y);

        std::cout << "Transcript valid." << std::endl;
        return 0;
    }
    catch (std::exception const &err)
    {
        std::cerr << err.what() << std::endl;
        return 1;
    }
}