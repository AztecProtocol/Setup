/**
 * Setup
 * Copyright Spilsbury Holdings 2019
 * 
 **/
#include <libff/algebra/curves/alt_bn128/alt_bn128_pp.hpp>

#include <stdio.h>

#include "setup.hpp"

int main()
{
    printf("initializing libff \n");
    libff::alt_bn128_pp::init_public_params();
    printf("attempting to generate setup variables \n");
    setup::run_setup<libff::alt_bn128_pp>();

    return true;
}