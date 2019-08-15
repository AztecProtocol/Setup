# setup-mpc-client

This project contains the client side application for the AZTEC trusted setup multi party computation.
It is distributed as a docker container from the official [AZTEC dockerhub repository](https://hub.docker.com/r/aztecprotocol/setup-mpc-client).

## Participating

Participants in the AZTEC trusted setup multi party computation fall into three tiers.

1. **Institutional participants** - These participants are known up front and have been formally accepted into the computation by AZTEC. They have top priority during the ceremony.
2. **Early bird individuals** - Participants that have signed up for the ceremony prior to the _selection date_.
3. **Individuals** - Participants that have signed up for the ceremony after the _selection date_, or who were not choosen during selection.

The _selection date_ is goverened by a predetermined Ethereum block height. The block hash of the block is used as a seed to a pseudo random number generator which first selects a number of participants from tier 2, and is then used to randomise the priority order of participants in both tier 1 and tier 2. Unselected participants and participants in tier 3 are ordered on a first come first served basis.

To sign up for participation, a user must send 1 wei to the AZTEC controlled address `0x000000000xxxxxxx0000000`. The private key of the sending address must be provided to the client application for authentication.

## Installing Docker

To run the docker container you must first have installed Docker.

- [Windows](https://hub.docker.com/editions/community/docker-ce-desktop-windows)
- [Mac](https://hub.docker.com/editions/community/docker-ce-desktop-mac)

For experienced users that wish to perform the computation as fast as possible, the user is encouraged to adjust the Docker preferences to provide access to all system cores and at least `XGB` of memory.

## Launching

To ensure the user has the latest version of the client application, first run:

```
docker pull aztecprotocol/setup-mpc-client
```

The client application can be launched as follows:

```
docker run -ti -e PRIVATE_KEY=<private key hex> aztecprotocol/setup-mpc-client
```

Example:

```
docker run -ti -e PRIVATE_KEY=0x469844c8ae3d0a18ec3f52779cd0e6d87a3c0395176f575d50e5810a086cf311 aztecprotocol/setup-mpc-client
```

## Dress Rehersal

In preparation for the MPC in September, we will be running multiple test runs of the MPC both internally and externally.
For ease of coordination amongst testers, the following set of addresses and corresponding private keys are being used.

These have been generated from the seed phrase: `alarm disagree index ridge tone outdoor betray pole forum source okay joy`.

```
Available Accounts
==================
(0) 0xbd38ef2e1b28b1e9de4e9f4dcb73e53f2ad23a42
(1) 0xd528f97aeb2297007f9348b295ee2d475918d517
(2) 0x93aecbc2c40caa8f48fbeeb37c2d53a75595f97f
(3) 0xa40a3556417b8ed46792057307a0ddf9338a83cb
(4) 0x9636ea9c10bb6fc903a4c753df93a064cae313c8
(5) 0x6bd7ea43fb9e05f551ad4128dd8e412b15b6a770
(6) 0x5e5aab22d5e22d47efc84f99d22b864a129a7cae
(7) 0xc6b1c9e9961d2cf7055b35dfbb09db3978e61419
(8) 0x3a548c928408762bfe12267246d4d1b6bc58a150
(9) 0xaf48021c027fa9de7f915d1899d5372de0270e9f

Private Keys
==================
(0) 0xf90214f59d15c663d4d13b06b115838ee8a397af1dbf6535479a818d6e32a26a
(1) 0xf64420705123ff35ad7c8129018603ba617967543ba08702d1786c54818daeb3
(2) 0x45957c9e386fc5eb87d295278c062a46949c91e9b3cfe25628be4a337374f448
(3) 0x920dd6d7d446ee9ca8abe4a380d8c2bebb39582e7d54af61fb1e83fdd4c925d6
(4) 0x3ce0bd0162b8575f67cbc587765443eddbf9d44571598b793327e2efcd66cba1
(5) 0x469844c8ae3d0a18ec3f52779cd0e6d87a3c0395176f575d50e5810a086cf318
(6) 0xa9f519cb7a3fff927a05408128e8c7c1127b4bccccd4b1a848c2389af3d98d44
(7) 0x36d89e1f7ee3de9a386b8740219e1498200929950a5fa74f61a34ae8f5cfd583
(8) 0x2e858c3290c0a01f8f392d4828cd07f864e3a2ae6e82b3ebad8ffa106f7904b7
(9) 0xa96bc82f643bbd0bc7fd26cb5d56a6c4f7bd9a9f7cac3f497618c2c26c15aad6
```

A tester should uniquely pick one of the accounts above and pass it's private key to the client application.

An example of how to run the client application pointing towards the staging environment for account `0`:

```
docker run -ti -e API_URL=https://setup-staging.aztecprotocol.com/api -e PRIVATE_KEY=0xf90214f59d15c663d4d13b06b115838ee8a397af1dbf6535479a818d6e32a26a aztecprotocol/setup-mpc-client
```
