// Copyright 2019 OpenST Ltd.
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

import 'mocha';
import { assert } from 'chai';
import LeafNode from '../../src/LeafNode';

describe('LeafNode::encodeCompact', (): void => {
  it('Reverts if a buffer is empty.', (): void => {
    assert.throws(
      (): Buffer => LeafNode.encodeCompact(Buffer.alloc(0)),
      'A nibble path to encode compact is empty.',
    );
  });

  it('Checks an odd-length buffer conversion.', (): void => {
    assert.deepEqual(
      LeafNode.encodeCompact(Buffer.from([0xF, 1, 0xC, 0xB, 8])),
      Buffer.from([0x3F, 0x1C, 0xB8]),
    );
  });

  it('Checks an even-length buffer conversion.', (): void => {
    assert.deepEqual(
      LeafNode.encodeCompact(Buffer.from([0, 0xF, 1, 0xC, 0xB, 8])),
      Buffer.from([0x20, 0xF, 0x1C, 0xB8]),
    );
  });
});
