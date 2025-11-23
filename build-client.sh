#!/bin/bash
# --- Script Configuration for Robustness ---

# Exit immediately if a command exits with a non-zero status.
set -e
# Treat unset variables as an error.
set -u
# Prevent errors in a pipeline from being masked.
set -o pipefail

# --- Configuration Variables ---

# Define the repository paths relative to the script location
SETUP_TOOLS_DIR="./setup-tools"
MPC_COMMON_DIR="./setup-mpc-common"
MPC_CLIENT_DIR="./setup-mpc-client"

# Define the Docker image tags (using variables for better readability and maintainability)
# ECR registry URL is hardcoded as per the original script, but placed in a variable.
ECR_REGISTRY="278380418400.dkr.ecr.eu-west-2.amazonaws.com"
MPC_COMMON_IMAGE="${ECR_REGISTRY}/setup-mpc-common:latest"
MPC_CLIENT_IMAGE="aztecprotocol/setup-mpc-client:latest"


echo "--- 1. Initializing and Updating Git Submodules ---"
# Initialize, update, and recursively check out all submodules in one command.
# This ensures all dependencies are present before building.
git submodule update --init --recursive
echo "Submodules successfully synchronized."


echo "--- 2. Building Setup Tools ---"
# Use a subshell (parentheses) to change directory. This ensures the script automatically
# returns to the parent directory after the commands inside the subshell are executed,
# regardless of success or failure. This is safer than relying on 'cd -'.
(
  # Enter the setup-tools directory
  cd "${SETUP_TOOLS_DIR}"
  echo "Executing build script in ${SETUP_TOOLS_DIR}..."
  
  # Execute the specific build script for setup-tools
  ./build.sh
  
  echo "Setup tools build complete."
)


echo "--- 3. Building Setup MPC Common Docker Image (ECR Target) ---"
(
  # Enter the common component directory
  cd "${MPC_COMMON_DIR}"
  echo "Building common Docker image: ${MPC_COMMON_IMAGE}..."
  
  # Build the image and tag it for the specific ECR registry
  docker build -t "${MPC_COMMON_IMAGE}" .
  
  echo "MPC Common image built successfully."
)


echo "--- 4. Building Setup MPC Client Docker Image (Docker Hub Target) ---"
(
  # Enter the client component directory
  cd "${MPC_CLIENT_DIR}"
  echo "Building client Docker image: ${MPC_CLIENT_IMAGE}..."
  
  # Build the image and tag it for the public Docker Hub
  docker build -t "${MPC_CLIENT_IMAGE}" .
  
  echo "MPC Client image built successfully."
)


echo "--- Build and Tagging Process Completed Successfully ---"

# Note: The original script did not include 'docker push' commands, 
# so they are not included here. If push is needed, it should be added here.
