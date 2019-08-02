#!/bin/sh
set -e
cd ./build
make setup verify
rm -f ../setup_db/* && ./setup ../setup_db/ 250000
./verify ../setup_db/transcript0_out.dat
./verify ../setup_db/transcript1_out.dat ../setup_db/transcript0_out.dat ../setup_db/transcript0_out.dat
./verify ../setup_db/transcript2_out.dat ../setup_db/transcript0_out.dat ../setup_db/transcript1_out.dat
mv ../setup_db/transcript0_out.dat ../setup_db/transcript0.dat && mv ../setup_db/transcript1_out.dat ../setup_db/transcript1.dat && mv ../setup_db/transcript2_out.dat ../setup_db/transcript2.dat
./setup ../setup_db/
./verify ../setup_db/transcript0_out.dat ../setup_db/transcript0_out.dat ../setup_db/transcript0.dat
./verify ../setup_db/transcript1_out.dat ../setup_db/transcript0_out.dat ../setup_db/transcript0_out.dat
./verify ../setup_db/transcript2_out.dat ../setup_db/transcript0_out.dat ../setup_db/transcript1_out.dat
