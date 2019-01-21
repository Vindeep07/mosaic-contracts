// Copyright 2018 OpenST Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// ----------------------------------------------------------------------------
//
// http://www.simpletoken.org/
//
// ----------------------------------------------------------------------------

const Gateway = artifacts.require("EIP20Gateway");
const MockToken = artifacts.require("MockToken");
const MockOrganization = artifacts.require('MockOrganization.sol');

const Utils = require("./../../test_lib/utils"),
  BN = require('bn.js');

const NullAddress = Utils.NULL_ADDRESS;

contract('EIP20Gateway.constructor() ', function (accounts) {

  let mockToken, baseToken, bountyAmount, dummyRootProviderAddress,
    mockOrganization, gateway, owner, worker, burner = NullAddress;

  beforeEach(async function () {

    mockToken = await MockToken.new();
    baseToken = await MockToken.new();
    dummyRootProviderAddress = accounts[1];
    bountyAmount = new BN(100);

    owner = accounts[2];
    worker = accounts[3];
    mockOrganization = await MockOrganization.new(owner, worker);
  });

  it('should able to deploy contract with correct parameters.', async function () {
    gateway = await
      Gateway.new(
        mockToken.address,
        baseToken.address,
        dummyRootProviderAddress,
        bountyAmount,
        mockOrganization.address,
        burner
      );

    assert(
      web3.utils.isAddress(gateway.address),
      "Returned value is not a valid address."
    );
  });

  it('should initialize gateway contract with correct parameters.', async function () {
    gateway = await
      Gateway.new(
        mockToken.address,
        baseToken.address,
        dummyRootProviderAddress,
        bountyAmount,
        mockOrganization.address,
        burner
      );

    let tokenAddress = await gateway.token.call();

    assert.equal(
      tokenAddress,
      mockToken.address,
      "Invalid valueTokenAddress address from contract."
    );

    let bountyTokenAdd = await gateway.baseToken.call();
    assert.equal(
      bountyTokenAdd,
      baseToken.address,
      "Invalid bounty token address from contract."
    );

    let stateRootProviderAdd = await gateway.stateRootProvider.call();
    assert.equal(
      stateRootProviderAdd,
      dummyRootProviderAddress,
      "Invalid stateRootProvider address from contract"
    );

    let bounty = await gateway.bounty.call();
    assert(
      bounty.eq(bountyAmount),
      "Invalid bounty amount from contract"
    );

    let isActivated = await gateway.activated.call();
    assert(
      !isActivated,
      "Gateway is not deactivated by default."
    );

  });

  it('should not deploy contract if token is passed as zero.', async function () {
    let mockToken = NullAddress;

    await Utils.expectRevert(
      Gateway.new(
        mockToken,
        baseToken.address,
        dummyRootProviderAddress,
        bountyAmount,
        mockOrganization.address,
        burner
      ),
      "Token contract address must not be zero."
    );
  });

  it('should not deploy contract if base token is passed as zero.', async function () {
    let baseTokenAddress = NullAddress;

    await Utils.expectRevert(
      Gateway.new(
        mockToken.address,
        baseTokenAddress,
        dummyRootProviderAddress,
        bountyAmount,
        mockOrganization.address,
        burner
      ),
      "Base token contract address for bounty must not be zero."
    );
  });

  it('should not deploy contract if state root provider contract address is passed as zero.', async function () {
    let stateRootProvider = NullAddress;

    await Utils.expectRevert(
      Gateway.new(
        mockToken.address,
        baseToken.address,
        stateRootProvider,
        bountyAmount,
        mockOrganization.address,
        burner
      ),
      "State root provider contract address must not be zero."
    );

  });

  it('should fail when organization address is passed as zero', async function () {
    let organization = NullAddress;

    await Utils.expectRevert(
      Gateway.new(
        mockToken.address,
        baseToken.address,
        dummyRootProviderAddress,
        bountyAmount,
        organization,
        burner
      ),
      "Organization contract address must not be zero."
    );

  });

  it('should able to deploy contract with zero bounty.', async function () {
    let bountyAmount = new BN(0);

    gateway = await
      Gateway.new(
        mockToken.address,
        baseToken.address,
        dummyRootProviderAddress,
        bountyAmount,
        mockOrganization.address,
        burner
      );

    assert(
      web3.utils.isAddress(gateway.address),
      "Returned value is not a valid address."
    );
  });
});