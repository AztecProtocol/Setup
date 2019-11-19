FROM circleci/python:3.6.8-jessie-node

USER root
RUN apt update

# Terraform
ENV TF_IN_AUTOMATION 1
ENV TERRAFORM_VERSION 0.12.16
RUN curl -sSL https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_linux_amd64.zip -o terraform.zip \
  && unzip terraform.zip \
  && mv terraform /usr/local/bin/ \
  && rm terraform.zip

# AWS CLI
RUN sudo pip install --upgrade awscli

# MBT
ENV MBT_VERSION 0.22.0
RUN curl -sSL -o /usr/local/bin/mbt https://bintray.com/buddyspike/bin/download_file?file_path=mbt_linux_x86_64/0.22.0/0.22.0/mbt_linux_x86_64 \
  && chmod +x /usr/local/bin/mbt

USER circleci