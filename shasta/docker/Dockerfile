FROM ubuntu as dev

# Add Git and SSH
RUN apt-get update && \
    apt-get install -y git openssh-client && \
    apt-get clean

# nvm requirements
RUN apt-get update
RUN apt-get install -y curl wget build-essential libssl-dev

# Install Python
RUN apt-get install -y python3 python3-distutils

# Install Clang and libc++-dev
RUN apt-get install -y clang libc++-dev

# Install libc++abi-dev
RUN apt-get install -y libc++abi-dev

# nvm env vars
RUN mkdir -p /usr/local/nvm
ENV NVM_DIR /usr/local/nvm

# IMPORTANT: set the exact version
ENV NODE_VERSION v16.17.1
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash &&\
    /bin/bash -c "source $NVM_DIR/nvm.sh && nvm install $NODE_VERSION && nvm use --delete-prefix $NODE_VERSION"

# Add node and npm to the PATH
ENV NODE_PATH $NVM_DIR/versions/node/$NODE_VERSION/bin
ENV PATH $NODE_PATH:$PATH

# Set npm configuration variable python
RUN npm config set python $(which python3)

COPY . /root/src
WORKDIR /root/src
RUN npm -v
RUN node -v

# Copy SSH keys (assuming id_rsa is in the project docker directory)
COPY docker/id_rsa /root/.ssh/id_rsa
RUN chmod 600 /root/.ssh/id_rsa

# Disable host key checking for SSH client (not recommended for production use)
RUN mkdir -p /root/.ssh
RUN echo "Host *\n\tStrictHostKeyChecking no\n\tUserKnownHostsFile /dev/null\n" > /root/.ssh/config

ENV GIT_SSH_COMMAND ssh
ENV CC clang
ENV CXX 'clang++ -stdlib=libc++'
ENV PYTHON python3

RUN npm install
