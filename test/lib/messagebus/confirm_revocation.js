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
//
// http://www.simpletoken.org/
//
// ----------------------------------------------------------------------------

const MessageBusUtils = require('./messagebus_utils');

contract('MessageBus.confirmRevocation()', async (accounts) => {
  let params;

  beforeEach(async () => {
    await MessageBusUtils.deployedMessageBus();
    params = MessageBusUtils.defaultParams(accounts);
  });

  it(
    'should fail when message status of the message hash in inbox is'
      + ' undeclared ',
    async () => {
      const message = 'Message on target must be Declared.';
      params.message = message;

      await MessageBusUtils.confirmRevocation(params, false);
    },
  );

  it(
    'should fail when message status of the message hash in inbox is'
      + ' progressed ',
    async () => {
      const message = 'Message on target must be Declared.';
      params.message = message;

      await MessageBusUtils.confirmMessage(params, true);
      await MessageBusUtils.progressInbox(params, true);

      await MessageBusUtils.confirmRevocation(params, false);
    },
  );

  it(
    'should fail when message status of the message hash in inbox is'
      + ' revoked',
    async () => {
      const message = 'Message on target must be Declared.';
      params.message = message;

      await MessageBusUtils.confirmMessage(params, true);
      await MessageBusUtils.confirmRevocation(params, true);

      await MessageBusUtils.confirmRevocation(params, false);
    },
  );
});
