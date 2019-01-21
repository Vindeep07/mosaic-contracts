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

const Gateway = artifacts.require("./TestEIP20Gateway.sol");
const MockToken = artifacts.require("MockToken");

const BN = require('bn.js');

const EventDecoder = require('../../test_lib/event_decoder.js');
const messageBus = require('../../test_lib/message_bus.js');
const Utils = require('../../../test/test_lib/utils');
const web3 = require('../../../test/test_lib/web3.js');

let MessageStatusEnum = messageBus.MessageStatusEnum;
contract('EIP20Gateway.revertStake()', function (accounts) {

  let gateway;
  let mockToken, baseToken;
  let bountyAmount = new BN(100);

  let stakeRequest = {
    beneficiary: accounts[6],
    stakeAmount: new BN(100),
  };

  let stakeMessage = {
    intentHash: web3.utils.sha3("dummy"),
    stakerNonce: new BN(1),
    gasPrice: new BN(1),
    gasLimit: new BN(2),
    staker: accounts[0],
  };

  beforeEach(async function () {

    mockToken = await MockToken.new({ from: accounts[0] });
    baseToken = await MockToken.new({ from: accounts[0] });

    let organization = accounts[1];
    let coreAddress = accounts[5];
    let burner = Utils.NULL_ADDRESS;

    gateway = await Gateway.new(
      mockToken.address,
      baseToken.address,
      coreAddress,
      bountyAmount,
      organization,
      burner,
    );

    let hashLockObj = Utils.generateHashLock();

    stakeMessage.hashLock = hashLockObj.l;
    stakeMessage.unlockSecret = hashLockObj.s;
    stakeMessage.messageHash = messageBus.messageDigest(
      stakeMessage.intentHash,
      stakeMessage.stakerNonce,
      stakeMessage.gasPrice,
      stakeMessage.gasLimit,
      stakeMessage.staker,
      stakeMessage.hashLock,
    );

    await gateway.setStake(
      stakeMessage.messageHash,
      stakeRequest.beneficiary,
      stakeRequest.stakeAmount,
    );
    await gateway.setMessage(
      stakeMessage.intentHash,
      stakeMessage.stakerNonce,
      stakeMessage.gasPrice,
      stakeMessage.gasLimit,
      stakeMessage.staker,
      stakeMessage.hashLock,
    );

  });

  it('should emit event on success', async function () {

    let penalty = new BN(150);

    await baseToken.approve(gateway.address, penalty, {from: stakeMessage.staker});
    await gateway.setOutboxStatus(
      stakeMessage.messageHash,
      MessageStatusEnum.Declared,
    );

    let tx = await gateway.revertStake(
      stakeMessage.messageHash,
      {from: stakeMessage.staker},
    );

    let event = EventDecoder.getEvents(tx, gateway);
    let eventData = event.RevertStakeIntentDeclared;

    assert.isDefined(
      event.RevertStakeIntentDeclared,
      'Event `RevertStakeIntentDeclared` must be emitted.',
    );
    assert.strictEqual(
      eventData._messageHash,
      stakeMessage.messageHash,
      `Expected message hash ${eventData._messageHash} is different from actual message hash ${stakeMessage.messageHash}`,
    );
    assert.strictEqual(
      eventData._staker,
      stakeMessage.staker,
      `Expected message hash ${eventData._staker} is different from actual message hash ${stakeMessage.staker}`,
    );
    assert.strictEqual(
      eventData._amount.eq(stakeRequest.stakeAmount),
      true,
      `Expected stake amount ${eventData._amount} is different from actual stake amount ${stakeRequest.stakeAmount}`,
    );
    assert.strictEqual(
      eventData._stakerNonce.eq(stakeMessage.stakerNonce),
      true,
      `Expected staker nonce ${eventData._stakerNonce} is different from actual staker nonce ${stakeMessage.stakerNonce}`,
    );

  });

  it('should return correct values', async function () {

    let penalty = new BN(150);

    await baseToken.approve(gateway.address, penalty, {from: stakeMessage.staker});
    await gateway.setOutboxStatus(
      stakeMessage.messageHash,
      MessageStatusEnum.Declared,
    );

    let returnedValues = await gateway.revertStake.call(
      stakeMessage.messageHash,
      {from: stakeMessage.staker},
    );

    assert.strictEqual(
      returnedValues.staker_,
      stakeMessage.staker,
      `Returned staker ${returnedValues.staker_} value is different from expected ${stakeMessage.staker} `,
    );
    assert.strictEqual(
      returnedValues.stakerNonce_.eq(stakeMessage.stakerNonce),
      true,
      `Returned staker nonce ${returnedValues.stakerNonce_.toNumber(10)}`
      + ` value is different from expected ${stakeMessage.stakerNonce.toNumber(10)} `,
    );
    assert.strictEqual(
      returnedValues.amount_.eq(stakeRequest.stakeAmount),
      true,
      `Returned amount ${returnedValues.amount_.toNumber(10)}`
      + ` value is different from expected ${stakeRequest.stakeAmount.toNumber(10)} `,
    );

  });

  it('should charge/transfer penalty', async function () {

    let gatewayInitialBalance = await baseToken.balanceOf(gateway.address);
    let stakerInitialBalance = await baseToken.balanceOf(stakeMessage.staker);

    let penalty = new BN(150);

    await baseToken.approve(gateway.address, penalty, {from: stakeMessage.staker});
    await gateway.setOutboxStatus(
      stakeMessage.messageHash,
      MessageStatusEnum.Declared,
    );

    await gateway.revertStake(
      stakeMessage.messageHash,
      {from: stakeMessage.staker},
    );

    let gatewayFinalBalance = await baseToken.balanceOf(gateway.address);
    let stakerFinalBalance = await baseToken.balanceOf(stakeMessage.staker);

    assert.strictEqual(
      gatewayFinalBalance.eq(gatewayInitialBalance.add(penalty)),
      true,
      'Penalty must be transferred to gateway',
    );
    assert.strictEqual(
      stakerFinalBalance.eq(stakerInitialBalance.sub(penalty)),
      true,
      'Penalty must be transferred from staker',
    );
  });

  it('should fail for zero message hash', async function () {

    let penalty = new BN(150);

    await baseToken.approve(gateway.address, penalty, {from: stakeMessage.staker});
    await gateway.setOutboxStatus(
      stakeMessage.messageHash,
      MessageStatusEnum.Declared,
    );

    await Utils.expectRevert(
      gateway.revertStake(
        Utils.ZERO_BYTES32,
        {from: stakeMessage.staker},
      ),
      'Message hash must not be zero.',
    );

  });

  it('should fail if revocation is already declared', async function () {

    let penalty = new BN(150);

    await baseToken.approve(gateway.address, penalty, {from: stakeMessage.staker});
    await gateway.setOutboxStatus(
      stakeMessage.messageHash,
      MessageStatusEnum.Declared,
    );
    await gateway.revertStake(
      stakeMessage.messageHash,
      {from: stakeMessage.staker},
    );

    await Utils.expectRevert(
      gateway.revertStake(
        stakeMessage.messageHash,
        {from: stakeMessage.staker},
      ),
      'Message on source must be Declared.'
    )
  });

  it('should fail for undeclared message', async function () {

    let penalty = new BN(150);

    await baseToken.approve(gateway.address, penalty, {from: stakeMessage.staker});
    await gateway.setOutboxStatus(
      stakeMessage.messageHash,
      MessageStatusEnum.Undeclared,
    );

    await Utils.expectRevert(
      gateway.revertStake(
        stakeMessage.messageHash,
        {from: stakeMessage.staker},
      ),
      'Message on source must be Declared.'
    )
  });

  it('should fail for progressed message', async function () {

    let penalty = new BN(150);

    await baseToken.approve(gateway.address, penalty, {from: stakeMessage.staker});
    await gateway.setOutboxStatus(
      stakeMessage.messageHash,
      MessageStatusEnum.Progressed,
    );

    await Utils.expectRevert(
      gateway.revertStake(
        stakeMessage.messageHash,
        {from: stakeMessage.staker},
      ),
      'Message on source must be Declared.'
    )
  });

  it('should fail for revoked message', async function () {

    let penalty = new BN(150);

    await baseToken.approve(gateway.address, penalty, {from: stakeMessage.staker});
    await gateway.setOutboxStatus(
      stakeMessage.messageHash,
      MessageStatusEnum.Revoked,
    );

    await Utils.expectRevert(
      gateway.revertStake(
        stakeMessage.messageHash,
        {from: stakeMessage.staker},
      ),
      'Message on source must be Declared.'
    );
  });

  it('should fail for non staker account', async function () {

    let penalty = new BN(150);

    await baseToken.approve(gateway.address, penalty, {from: stakeMessage.staker});
    await gateway.setOutboxStatus(
      stakeMessage.messageHash,
      MessageStatusEnum.Declared,
    );

    await Utils.expectRevert(
      gateway.revertStake(
        stakeMessage.messageHash,
        {from: accounts[10]},
      ),
      'Only staker can revert stake.'
    );
  });

  it('should fail if gateway is not approved for penalty amount', async function () {

    await gateway.setOutboxStatus(
      stakeMessage.messageHash,
      MessageStatusEnum.Declared,
    );

    await Utils.expectRevert(
      gateway.revertStake(
        stakeMessage.messageHash,
        {from: stakeMessage.staker},
      ),
      'Underflow when subtracting.'
    );

  });

});