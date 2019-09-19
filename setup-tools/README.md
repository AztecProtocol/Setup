# AZTEC Protocol Trusted Setup Repository

**THIS CODE IS HIGHLY EXPERIMENTAL AND HAS NOT BEEN THOROUGHLY TESTED, USE AT YOUR OWN RISK!**

This repo contains compiles several C++ executables that run the AZTEC trusted setup ceremony.

- **setup** will perform one round of the trusted setup MPC.
- **seal** the same as `setup`, but uses a hash of the previous participants transcripts as the secret.
- **verify** verifies a transcript files points have been correctly processed relative to a previous transcript file.
- **compute_generator_polynomial** will compute the polynomial coefficients required to construct the AZTEC generator point `h`, from the results of _setup_.
- **prep_range_data** prepares a set of transcripts for post processing by _compute_range_polynomials_.
- **compute_range_polynomials** will compute the AZTEC signature points `mu_k`, from the results of _setup_ and _compute_generator_polynomial_.
- **print_point** will print the given point for a given curve from a given transcript.

The common reference string produced by `setup` can also be used to construct structured reference strings for [SONIC zk-SNARKS](https://eprint.iacr.org/2019/099.pdf)

## Install Instructions

To build:

`docker-compose build setup-tools`

This creates a docker image with the executables located in `/usr/src/setup-tools`.

To launch the container to run the tools:

```
docker-compose run setup-tools
```

## Usage

### setup

_setup_ will perform a single round of computation for the trusted setup MPC. If it is being run as the first participant it expects additional arguments specifying the number of G1 and G2 points to generate.
If running as a subsequent participant it only requires the directory of the previous participants transcripts (renamed accordingly) and it will produce the corresponding outputs.

```
usage: ./setup <transcript dir> [<initial num g1 points> <initial num g2 points>]
```

The following will generate the initial `250,000` G1 points and a single G2 point and write the transcripts to the `../setup_db` directory. The output filenames follow the format `transcript0_out.dat`, `transcript1_out.dat`, `transcript<n>_out.dat`.

```
$ ./setup ../setup_db 250000 1
Creating initial transcripts...
creating 0:6400220 1:6400092 2:3200092
Will compute 100000 G1 points and 1 G2 points starting from 0 in transcript 0
Computing g1 multiple-exponentiations...
progress 20.0348
...
...
Writing transcript...
wrote 2
Done.
```

The following will take the previous set of transcripts which must be named `transcript0.dat`, `transcript1.dat`, `transcript<n>.dat`, and will produce a new set of outputs.

```
$ ./setup ../setup_db
Reading transcript...
Will compute 100000 G1 points and 1 G2 points on top of transcript 0
Computing g1 multiple-exponentiations...
progress 20.6704
...
...
Writing transcript...
wrote 2
Done.
```

### seal

The same as `setup`, but compiled with `SEALING`, where the toxic waste is set to the hash of the previous transcript.

### verify

_verify_ will check that the points in a given transcript have been computed correctly. For the first participant, we only need to check that the powering sequence is consistent across all transcripts.
For a subsequent participant, we also check that the initial point is an exponentiation of the previous participants initial point.

```
usage: ./verify <total G1 points> <total G2 points> <points per transcript> <transcript num> <transcript path> [<transcript 0 path> <previous transcript path>]
```

Verification of a transcript file, always requires the initial point to be available. The second transcript path should always point to transcript 0 in a sequence of transcripts. The following validates that transcript 2 follows from transcript 1.

```
$ ./verify 1000000 1 50000 2 ../setup_db/transcript2_out.dat ../setup_db/transcript0_out.dat ../setup_db/transcript1_out.dat
Verifying...
Transcript valid.
```

The following checks that the initial transcript of a new sequence of transcripts, was built on top of the previous participants transcripts. Note how the 3rd transcript path is the input transcript that was fed to _setup_.

```
$ ./verify 1000000 1 50000 0 ../setup_db/transcript0_out.dat ../setup_db/transcript0_out.dat ../setup_db/transcript0.dat
Verifying...
Transcript valid.
```

### compute_generator_polynomial

_compute_generator_polynomial_ calculates the coefficients necessary to compute the AZTEC generator point.

```
usage: ./compute_generator_polynomial <num g1 points>
```

### prep_range_data

_prep_range_data_ takes the output of _setup_ and _compute_generator_polynomial_ and produces outputs that are suitable for memory mapping within _compute_range_polynomial_.

```
usage: ./prep_range_data <num_g1_points>
```

**TODO**: Modify to accept transcript range. Currently expects a single transcript file and the generator file in `../setup_db`.

### compute_range_polynomial

_compute_range_polynomial_ calculates a signature point necessary for range proofs.

```
usage: ./compute_range_polynomial <point to compute> <num g1 points>
```

**TODO**: Modify to take input files as arguments. Determine `<num g1 points>` from size of input files.

### print_point

_print_point_range_polynomial_ prints the given point for a given curve from a given transcript.

```
usage: ./print_point <transcript path> <g1 || g2> <point num>
```

## Development

To ease development you can create an image with necessary build environment, with your current source code mounted into the conatiner.

```
docker-compose build build-env
docker-compose run build-env
```

Once in the container you can build executables from your modified source code on the host:

```
mkdir build
cd ./build
cmake ..
make [executable name]
```
