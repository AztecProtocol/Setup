/**
 * Setup
 * Copyright Spilsbury Holdings 2019
 **/
#include <iostream>
#include <string>
#include <aztec_common/streaming_transcript.hpp>

int main(int argc, char **argv)
{
    if (argc != 4)
    {
        std::cout << "usage: " << argv[0] << " <transcript path> <g1 || g2> <point num>" << std::endl;
        return 1;
    }
    std::string const transcript_path(argv[1]);
    std::string const curve(argv[2]);
    size_t const point_num = strtol(argv[3], NULL, 0);

    if (!streaming::is_file_exist(transcript_path))
    {
        std::cout << "Transcript not found: " << transcript_path << std::endl;
        return 1;
    }

    libff::alt_bn128_pp::init_public_params();

    try
    {
        std::vector<G1> g1_x;
        std::vector<G2> g2_x;

        if (curve == "g1")
        {
            streaming::read_transcript_g1_points(g1_x, transcript_path, point_num, 1);
            if (g1_x.size() != 1)
            {
                throw std::runtime_error("Point not found.");
            }
            g1_x[0].print();
        }
        else
        {
            streaming::read_transcript_g2_points(g2_x, transcript_path, point_num, 1);
            if (g2_x.size() != 1)
            {
                throw std::runtime_error("Point not found.");
            }
            g2_x[0].print();
        }

        return 0;
    }
    catch (std::exception const &err)
    {
        std::cerr << err.what() << std::endl;
        return 1;
    }
}