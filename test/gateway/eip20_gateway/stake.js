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

const Gateway = artifacts.require("TestEIP20Gateway"),
    MockToken = artifacts.require("MockToken"),
    MessageBus = artifacts.require("MessageBus"),
    GatewayLib = artifacts.require("GatewayLib");

const utils = require("./../../test_lib/utils"),
    BN = require('bn.js'),
    EIP20GatewayKlass = require("./helpers/eip20_gateway"),
    HelperKlass = require("./helpers/helper");

const PENALTY_PERCENT = 1.5;
const NullAddress = "0x0000000000000000000000000000000000000000";

let stakeAmount,
    beneficiary,
    stakerAddress,
    gasPrice,
    gasLimit,
    nonce,
    hashLock,
    messageHash,
    bountyAmount;
    bountyAmount,
    burner = NullAddress;

let mockToken,
    baseToken,
    gateway,
    helper,
    hashLockObj,
    gatewayTest,
    errorMessage;


async function _setup(accounts, gateway) {

    helper = new HelperKlass(gateway);
    gatewayTest = new EIP20GatewayKlass(gateway, mockToken, baseToken);


    hashLockObj = utils.generateHashLock();

    stakerAddress = accounts[4];
    nonce = await helper.getNonce(accounts[1]);
    stakeAmount = new BN(100000000000);
    beneficiary = accounts[2];
    stakerAddress = accounts[1];
    gasPrice = new BN(200);
    gasLimit = new BN(900000);
    hashLock = hashLockObj.l;


    await mockToken.transfer(stakerAddress, stakeAmount, { from: accounts[0] });
    await mockToken.approve(gateway.address, stakeAmount, { from: stakerAddress });

    await baseToken.transfer(stakerAddress, bountyAmount, { from: accounts[0] });
    await baseToken.approve(gateway.address, bountyAmount, { from: stakerAddress });

    errorMessage = "";
}

async function _prepareData() {
    let typeHash = await helper.stakeTypeHash();

    let intentHash = await helper.hashStakeIntent(
        stakeAmount,
        beneficiary,
        stakerAddress,
        nonce,
        gasPrice,
        gasLimit,
        mockToken.address
    );

    messageHash = await utils.messageHash(
        typeHash,
        intentHash,
        nonce,
        gasPrice,
        gasLimit,
        stakerAddress
    );
}

async function _stake(resultType) {

    let params = {
        amount: stakeAmount,
        beneficiary: beneficiary,
        staker: stakerAddress,
        gasPrice: gasPrice,
        gasLimit: gasLimit,
        nonce: nonce,
        hashLock: hashLock
    };

    let expectedResult = {
        returns: { messageHash: messageHash },
        events: {
            StakeIntentDeclared: {
                _messageHash: messageHash,
                _staker: stakerAddress,
                _stakerNonce: nonce,
                _beneficiary: beneficiary,
                _amount: stakeAmount
            }
        },
        errorMessage: errorMessage
    };

    let txOption = {
        from: stakerAddress
    };

    await gatewayTest.stake(
        params,
        resultType,
        expectedResult,
        txOption
    );
}

contract('EIP20Gateway.stake() ', function (accounts) {


    beforeEach(async function () {

        mockToken = await MockToken.new();
        baseToken = await MockToken.new();

        bountyAmount = new BN(100);
        gateway = await Gateway.new(
            mockToken.address,
            baseToken.address,
            accounts[1], //core address
            bountyAmount,
            accounts[2], // organisation address,
            burner
        );

        await _setup(accounts, gateway);
    });

    it('should fail to stake when stake amount is 0', async function () {
        stakeAmount = new BN(0);
        errorMessage = "Stake amount must not be zero";
        await _prepareData();
        await _stake(utils.ResultType.FAIL);
    });

    it('should fail to stake when beneficiary address is 0', async function () {
        beneficiary = "0x0000000000000000000000000000000000000000";
        errorMessage = "Beneficiary address must not be zero";
        await _prepareData();
        await _stake(utils.ResultType.FAIL);
    });


    it('should fail to stake when staker has balance less than the stake amount', async function () {
        stakeAmount = new BN(200000000000);
        await mockToken.approve(gateway.address, stakeAmount, { from: stakerAddress });
        await _prepareData();
        errorMessage = "revert";
        await _stake(utils.ResultType.FAIL);
    });

    it('should fail to stake when stakerAddress has balance less than the bounty amount', async function () {
        await baseToken.transfer(accounts[0], new BN(50), { from: stakerAddress });
        await _prepareData();
        errorMessage = "revert";
        await _stake(utils.ResultType.FAIL);
    });

    it('should fail to stake when gateway is not approved by the staker', async function () {
        stakerAddress = accounts[5];
        await mockToken.transfer(stakerAddress, stakeAmount, { from: accounts[0] });
        await _prepareData();
        errorMessage = "revert";
        await _stake(utils.ResultType.FAIL);
    });

    it('should successfully stake', async function () {
        await _prepareData();
        await _stake(utils.ResultType.SUCCESS);
    });

    it('should fail when its already staked with same data (replay attack)', async function () {

        await _prepareData();
        await _stake(utils.ResultType.SUCCESS);

        await mockToken.transfer(stakerAddress, stakeAmount, { from: accounts[0] });
        await baseToken.transfer(stakerAddress, bountyAmount, { from: accounts[0] });
        await mockToken.approve(gateway.address, stakeAmount, { from: stakerAddress });
        await baseToken.approve(gateway.address, bountyAmount, { from: stakerAddress });

        errorMessage = "Invalid nonce";
        await _stake(utils.ResultType.FAIL);
    });

    it('should fail to stake when previous stake for same address is not progressed', async function () {

        await _prepareData();
        await _stake(utils.ResultType.SUCCESS);

        await mockToken.transfer(stakerAddress, stakeAmount, { from: accounts[0] });
        await baseToken.transfer(stakerAddress, bountyAmount, { from: accounts[0] });
        await mockToken.approve(gateway.address, stakeAmount, { from: stakerAddress });
        await baseToken.approve(gateway.address, bountyAmount, { from: stakerAddress });

        nonce = new BN(2);
        await _prepareData();
        errorMessage = "Previous process is not completed";
        await _stake(utils.ResultType.FAIL);

    });

    it('should fail when previous stake for same address is in revocation', async function () {

        await _prepareData();
        await _stake(utils.ResultType.SUCCESS);

        let penalty = new BN(bountyAmount * PENALTY_PERCENT);

        // funding staker for penalty amount
        await baseToken.transfer(stakerAddress, penalty, { from: accounts[0] });
        // approving gateway for penalty amount
        await baseToken.approve(gateway.address, penalty, { from: stakerAddress });

        //revertStaking
        await gateway.revertStake(messageHash, { from: stakerAddress });

        await mockToken.transfer(stakerAddress, stakeAmount, { from: accounts[0] });
        await baseToken.transfer(stakerAddress, bountyAmount, { from: accounts[0] });
        await mockToken.approve(gateway.address, stakeAmount, { from: stakerAddress });
        await baseToken.approve(gateway.address, bountyAmount, { from: stakerAddress });

        nonce = new BN(2);
        await _prepareData();
        errorMessage = "Previous process is not completed";
        await _stake(utils.ResultType.FAIL);
    });

    it('should fail stake if gateway is not activated.', async function () {

        let mockToken = await MockToken.new();
        let baseToken = await MockToken.new();
        let bountyAmount = new BN(100);

        gateway = await Gateway.new(
            mockToken.address,
            baseToken.address,
            accounts[1], //core address
            bountyAmount,
            accounts[2], // organisation address
            burner
        );

        await _setup(accounts, gateway);
        await _prepareData();
        await _stake(utils.ResultType.FAIL);
    });

});
