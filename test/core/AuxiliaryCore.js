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
// Test: AuxiliaryCore.js
//
// http://www.simpletoken.org/
//
// ----------------------------------------------------------------------------

const BigNumber = require('bignumber.js');
const eventsDecoder = require('../lib/event_decoder.js');
const utils = require('../lib/utils.js');

const AuxiliaryCore = artifacts.require('AuxiliaryCore');

contract('AuxiliaryCore', async (accounts) => {
    describe('reporting an origin block', async () => {
        let auxiliaryCore;

        beforeEach(async () => {
            auxiliaryCore = await AuxiliaryCore.new(1);
        });

        it('should accept a correct block report', async () => {
            let expectedStateRoot = '0xb59b762b2a1d476556dd6163bc8ec39967c4debec82ee534c0aed7a143939ed2';
            let chainHeight = 37;

            await auxiliaryCore.reportOriginBlock(
                chainHeight,
                expectedStateRoot,
                {
                    from: accounts[0],
                    value: new BigNumber('1000000000000000000')
                }
            );

            let reportedOriginBlock = await auxiliaryCore.reportedOriginBlocks.call(expectedStateRoot);

            // Access properties by index
            assert.strictEqual(
                reportedOriginBlock[0].toNumber(),
                chainHeight,
                'The contract did not store the height that was reported.'
            );
            assert.strictEqual(
                reportedOriginBlock[1],
                expectedStateRoot,
                'The contract did not store the state root that was reported.'
            );
        });

        it('should emit an event for a correct block report', async () => {
            let expectedStateRoot = '0xb59b762b2a1d476556dd6163bc8ec39967c4debec82ee534c0aed7a143939ed2';
            let chainHeight = 37;

            let tx = await auxiliaryCore.reportOriginBlock(
                chainHeight,
                expectedStateRoot,
                {
                    from: accounts[0],
                    value: new BigNumber('1000000000000000000')
                }
            );

            let events = eventsDecoder.perform(tx.receipt, auxiliaryCore.address, auxiliaryCore.abi);
            assert.strictEqual(
                Number(events.OriginBlockReported.height),
                chainHeight,
                'The contract did not emit an event with the given chain height.'
            );
            assert.strictEqual(
                events.OriginBlockReported.stateRoot,
                expectedStateRoot,
                'The contract did not emit an event with the given state root.'
            );

        });

        it('should record all blocks at a single height', async () => {
            let expectedStateRootOne = '0xb59b762b2a1d476556dd6163bc8ec39967c4debec82ee534c0aed7a143939ed2';
            let expectedStateRootTwo = '0xdedde29f6dd592919e6d855b65aa8f1b55172a83f2f4810a13758d9f58c13f54';
            let chainHeight = 33;

            // Report two different state roots
            await auxiliaryCore.reportOriginBlock(
                chainHeight,
                expectedStateRootOne,
                {
                    from: accounts[0],
                    value: new BigNumber('1000000000000000000')
                }
            );
            await auxiliaryCore.reportOriginBlock(
                chainHeight,
                expectedStateRootTwo,
                {
                    from: accounts[0],
                    value: new BigNumber('1000000000000000000')
                }
            );

            let reportedOriginBlock = await auxiliaryCore.reportedOriginBlocks.call(expectedStateRootOne);
            // Access properties by index
            assert.strictEqual(
                reportedOriginBlock[0].toNumber(),
                chainHeight,
                'The contract did not store the height that was reported.'
            );
            assert.strictEqual(
                reportedOriginBlock[1],
                expectedStateRootOne,
                'The contract did not store the state root that was reported.'
            );

            reportedOriginBlock = await auxiliaryCore.reportedOriginBlocks.call(expectedStateRootTwo);
            // Access properties by index
            assert.strictEqual(
                reportedOriginBlock[0].toNumber(),
                chainHeight,
                'The contract did not store the height that was reported.'
            );
            assert.strictEqual(
                reportedOriginBlock[1],
                expectedStateRootTwo,
                'The contract did not store the state root that was reported.'
            );
        });

        it('should reject a report with an invalid state root', async () => {
            let invalidStateRoot = '0x0000000000000000000000000000000000000000000000000000000000000000';
            let chainHeight = 12;

            await utils.expectRevert(
                auxiliaryCore.reportOriginBlock(
                    chainHeight,
                    invalidStateRoot,
                    {
                        from: accounts[0],
                        value: new BigNumber('1000000000000000000')
                    }
                )
            );
        });

        it('should reject a duplicate report', async () => {
            let expectedStateRoot = '0xb59b762b2a1d476556dd6163bc8ec39967c4debec82ee534c0aed7a143939ed2';
            let chainHeight = 3;

            await auxiliaryCore.reportOriginBlock(
                chainHeight,
                expectedStateRoot,
                {
                    from: accounts[0],
                    value: new BigNumber('1000000000000000000')
                }
            );

            // Reporting the same state root again should lead to an error.
            await utils.expectRevert(
                auxiliaryCore.reportOriginBlock(
                    chainHeight,
                    expectedStateRoot,
                    {
                        from: accounts[0],
                        value: new BigNumber('1000000000000000000')
                    }
                )
            );
        });

        it('should reject a report where the sent value is too low', async () => {
            let expectedStateRoot = '0xb59b762b2a1d476556dd6163bc8ec39967c4debec82ee534c0aed7a143939ed2';
            let chainHeight = 3;

            await utils.expectRevert(
                auxiliaryCore.reportOriginBlock(
                    chainHeight,
                    expectedStateRoot,
                    {
                        from: accounts[0],
                        value: new BigNumber('999999999999999999')
                    }
                )
            );
        });

        it('should reject a report where the sent value is too high', async () => {
            let expectedStateRoot = '0xb59b762b2a1d476556dd6163bc8ec39967c4debec82ee534c0aed7a143939ed2';
            let chainHeight = 3;

            await utils.expectRevert(
                auxiliaryCore.reportOriginBlock(
                    chainHeight,
                    expectedStateRoot,
                    {
                        from: accounts[0],
                        value: new BigNumber('1000000000000000001')
                    }
                )
            );
        });
    });

    describe('reporting an auxiliary checkpoint', async () => {
        let auxiliaryCore;

        beforeEach(async () => {
            auxiliaryCore = await AuxiliaryCore.new(1);
        });

        it('should accept a correct checkpoint report', async () => {
            let expectedBlockHash = '0xb59b762b2a1d476556dd6163bc8ec39967c4debec82ee534c0aed7a143939ed2';
            let blockHeight = 300;

            await auxiliaryCore.reportAuxiliaryCheckpoint(
                blockHeight,
                expectedBlockHash
            );

            let reportedAuxiliaryCheckpoint = await auxiliaryCore.reportedAuxiliaryCheckpoints.call(expectedBlockHash);

            // Access properties by index
            assert.strictEqual(
                reportedAuxiliaryCheckpoint[0].toNumber(),
                blockHeight,
                'The contract did not store the height that was reported.'
            );
            assert.strictEqual(
                reportedAuxiliaryCheckpoint[1],
                expectedBlockHash,
                'The contract did not store the block hash that was reported.'
            );
        });

        it('should emit an event for a correct checkpoint report', async () => {
            let expectedBlockHash = '0xb59b762b2a1d476556dd6163bc8ec39967c4debec82ee534c0aed7a143939ed2';
            let blockHeight = 1200;

            let tx = await auxiliaryCore.reportAuxiliaryCheckpoint(
                blockHeight,
                expectedBlockHash
            );

            let events = eventsDecoder.perform(tx.receipt, auxiliaryCore.address, auxiliaryCore.abi);
            assert.strictEqual(
                Number(events.AuxiliaryCheckpointReported.height),
                blockHeight,
                'The contract did not emit an event with the given block height.'
            );
            assert.strictEqual(
                events.AuxiliaryCheckpointReported.blockHash,
                expectedBlockHash,
                'The contract did not emit an event with the given block hash.'
            );

        });

        it('should record all checkpoints at a single height', async () => {
            let expectedBlockHashOne = '0xb59b762b2a1d476556dd6163bc8ec39967c4debec82ee534c0aed7a143939ed2';
            let expectedBlockHashTwo = '0xdedde29f6dd592919e6d855b65aa8f1b55172a83f2f4810a13758d9f58c13f54';
            let blockHeight = 700;

            // Report two different block hashes
            await auxiliaryCore.reportAuxiliaryCheckpoint(
                blockHeight,
                expectedBlockHashOne
            );
            await auxiliaryCore.reportAuxiliaryCheckpoint(
                blockHeight,
                expectedBlockHashTwo
            );

            let reportedCheckpoint = await auxiliaryCore.reportedAuxiliaryCheckpoints.call(expectedBlockHashOne);
            // Access properties by index
            assert.strictEqual(
                reportedCheckpoint[0].toNumber(),
                blockHeight,
                'The contract did not store the height that was reported.'
            );
            assert.strictEqual(
                reportedCheckpoint[1],
                expectedBlockHashOne,
                'The contract did not store the block hash that was reported.'
            );

            reportedCheckpoint = await auxiliaryCore.reportedAuxiliaryCheckpoints.call(expectedBlockHashTwo);
            // Access properties by index
            assert.strictEqual(
                reportedCheckpoint[0].toNumber(),
                blockHeight,
                'The contract did not store the height that was reported.'
            );
            assert.strictEqual(
                reportedCheckpoint[1],
                expectedBlockHashTwo,
                'The contract did not store the block hash that was reported.'
            );
        });

        it('should reject a report with an invalid block hash', async () => {
            let invalidBlockHash = '0x0000000000000000000000000000000000000000000000000000000000000000';
            let blockHeight = 700;

            await utils.expectRevert(
                auxiliaryCore.reportAuxiliaryCheckpoint(
                    blockHeight,
                    invalidBlockHash
                )
            );
        });

        it('should reject a duplicate report', async () => {
            let expectedBlockHash = '0xb59b762b2a1d476556dd6163bc8ec39967c4debec82ee534c0aed7a143939ed2';
            let blockHeight = 700;

            await auxiliaryCore.reportAuxiliaryCheckpoint(
                blockHeight,
                expectedBlockHash
            );

            // Reporting the same block hash again should lead to an error.
            await utils.expectRevert(
                auxiliaryCore.reportAuxiliaryCheckpoint(
                    blockHeight,
                    expectedBlockHash
                )
            );
        });

        it('should reject a report where block height is not a multiple of the epoch length', async () => {
            let blockHash = '0xb59b762b2a1d476556dd6163bc8ec39967c4debec82ee534c0aed7a143939ed2';
            let blockHeight = 750;

            await utils.expectRevert(
                auxiliaryCore.reportAuxiliaryCheckpoint(
                    blockHeight,
                    blockHash
                )
            );
        });
    });
});
