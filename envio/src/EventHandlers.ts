import { ERC20 } from "generated";

/**
 * Transfer Event Handler
 * Indexes ERC-20 token transfers and updates holder balances
 */
ERC20.Transfer.handler(async ({ event, context }) => {
  const { from, to, value } = event.params;
  
  // Create Transfer entity
  const transfer = {
    id: `${event.transactionHash}-${event.logIndex}`,
    from: from,
    to: to,
    value: value,
    blockNumber: event.block.number,
    timestamp: event.block.timestamp,
    transactionHash: event.transactionHash,
    logIndex: event.logIndex,
  };
  
  context.Transfer.set(transfer);
  
  // Update sender balance (excluding mint events)
  if (from !== "0x0000000000000000000000000000000000000000") {
    let sender = await context.TokenHolder.get(from);
    if (sender) {
      sender.balance -= value;
      sender.transferCount += 1;
      sender.lastActivityTimestamp = event.block.timestamp;
      context.TokenHolder.set(sender);
    }
  }
  
  // Update recipient balance (excluding burn events)
  if (to !== "0x0000000000000000000000000000000000000000") {
    let recipient = await context.TokenHolder.get(to);
    if (!recipient) {
      recipient = {
        id: to,
        address: to,
        balance: 0n,
        approvalCount: 0,
        transferCount: 0,
        lastActivityTimestamp: event.block.timestamp,
      };
    }
    recipient.balance += value;
    recipient.transferCount += 1;
    recipient.lastActivityTimestamp = event.block.timestamp;
    context.TokenHolder.set(recipient);
  }
});

/**
 * Approval Event Handler  
 * Indexes ERC-20 token approvals for risk analysis
 */
ERC20.Approval.handler(async ({ event, context }) => {
  const { owner, spender, value } = event.params;
  
  // Create Approval entity
  const approval = {
    id: `${event.transactionHash}-${event.logIndex}`,
    owner: owner,
    spender: spender,
    value: value,
    blockNumber: event.block.number,
    timestamp: event.block.timestamp,
    transactionHash: event.transactionHash,
    logIndex: event.logIndex,
  };
  
  context.Approval.set(approval);
  
  // Update owner's approval count
  let ownerHolder = await context.TokenHolder.get(owner);
  if (!ownerHolder) {
    ownerHolder = {
      id: owner,
      address: owner,
      balance: 0n,
      approvalCount: 0,
      transferCount: 0,
      lastActivityTimestamp: event.block.timestamp,
    };
  }
  ownerHolder.approvalCount += 1;
  ownerHolder.lastActivityTimestamp = event.block.timestamp;
  context.TokenHolder.set(ownerHolder);
});
