import { CATALOG_ITEMS, type CatalogItemId } from "../shared/catalog.ts";
import { PROTOCOL_VERSION, type EconomySnapshot } from "../shared/protocol.ts";
import type { SessionChange, SessionNotice } from "./world.mts";

export type EconomyErrorCode =
  | "NOT_IN_ROOM"
  | "ROOM_MISMATCH"
  | "INVALID_AMOUNT"
  | "INVALID_TRANSACTION_ID"
  | "INVALID_ITEM"
  | "INSUFFICIENT_FUNDS";

export type EconomyMutationResult =
  | { ok: true; coins: number; inventory: Record<string, number> }
  | { ok: false; code: EconomyErrorCode };

interface PlayerEconomy {
  playerId: string;
  roomId: string;
  connectionId: string | null;
  coins: number;
  inventory: Map<CatalogItemId, number>;
  transactions: Map<string, EconomyMutationResult>;
}

function serializeInventory(inventory: Map<CatalogItemId, number>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [itemId, count] of inventory.entries()) {
    if (count > 0) result[itemId] = count;
  }
  return result;
}

function validTransactionId(transactionId: string) {
  return typeof transactionId === "string" && transactionId.length >= 1 && transactionId.length <= 128;
}

export class EconomyManager {
  private readonly accounts = new Map<string, PlayerEconomy>();
  private readonly options: {
    publish: (snapshot: EconomySnapshot, connectionId: string) => void;
  };

  constructor(options: { publish: (snapshot: EconomySnapshot, connectionId: string) => void }) {
    this.options = options;
  }

  sync(notice: SessionNotice, change: SessionChange) {
    if (change === "removed") {
      this.accounts.delete(notice.playerId);
      return;
    }

    let account = this.accounts.get(notice.playerId);
    if (!account) {
      account = {
        playerId: notice.playerId,
        roomId: notice.roomId,
        connectionId: notice.connectionId,
        coins: 0,
        inventory: new Map(),
        transactions: new Map(),
      };
      this.accounts.set(notice.playerId, account);
    } else {
      account.connectionId = notice.connectionId;
    }

    if (change === "bound" && account.connectionId) {
      this.publish(account);
    }
  }

  snapshot(playerId: string): EconomySnapshot | null {
    const account = this.accounts.get(playerId);
    if (!account) return null;
    return {
      version: PROTOCOL_VERSION,
      roomId: account.roomId,
      playerId: account.playerId,
      coins: account.coins,
      inventory: serializeInventory(account.inventory),
    };
  }

  credit(request: {
    roomId: string;
    playerId: string;
    amount: number;
    transactionId: string;
  }): EconomyMutationResult {
    if (!validTransactionId(request.transactionId)) {
      return { ok: false, code: "INVALID_TRANSACTION_ID" };
    }
    if (!Number.isSafeInteger(request.amount) || request.amount <= 0) {
      return { ok: false, code: "INVALID_AMOUNT" };
    }
    const account = this.accounts.get(request.playerId);
    if (!account) return { ok: false, code: "NOT_IN_ROOM" };
    if (account.roomId !== request.roomId) return { ok: false, code: "ROOM_MISMATCH" };

    const existing = account.transactions.get(request.transactionId);
    if (existing) return existing;

    account.coins += request.amount;
    const result: EconomyMutationResult = {
      ok: true,
      coins: account.coins,
      inventory: serializeInventory(account.inventory),
    };
    account.transactions.set(request.transactionId, result);
    this.publish(account);
    return result;
  }

  debit(request: {
    roomId: string;
    playerId: string;
    amount: number;
    transactionId: string;
  }): EconomyMutationResult {
    if (!validTransactionId(request.transactionId)) {
      return { ok: false, code: "INVALID_TRANSACTION_ID" };
    }
    if (!Number.isSafeInteger(request.amount) || request.amount <= 0) {
      return { ok: false, code: "INVALID_AMOUNT" };
    }
    const account = this.accounts.get(request.playerId);
    if (!account) return { ok: false, code: "NOT_IN_ROOM" };
    if (account.roomId !== request.roomId) return { ok: false, code: "ROOM_MISMATCH" };

    const existing = account.transactions.get(request.transactionId);
    if (existing) return existing;

    if (account.coins < request.amount) {
      const failed: EconomyMutationResult = { ok: false, code: "INSUFFICIENT_FUNDS" };
      account.transactions.set(request.transactionId, failed);
      return failed;
    }

    account.coins -= request.amount;
    const result: EconomyMutationResult = {
      ok: true,
      coins: account.coins,
      inventory: serializeInventory(account.inventory),
    };
    account.transactions.set(request.transactionId, result);
    this.publish(account);
    return result;
  }

  purchase(request: {
    roomId: string;
    playerId: string;
    itemId: CatalogItemId;
    quantity?: number;
    transactionId: string;
  }): EconomyMutationResult {
    if (!validTransactionId(request.transactionId)) {
      return { ok: false, code: "INVALID_TRANSACTION_ID" };
    }
    const quantity = request.quantity ?? 1;
    if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 99) {
      return { ok: false, code: "INVALID_AMOUNT" };
    }
    const item = CATALOG_ITEMS[request.itemId];
    if (!item) return { ok: false, code: "INVALID_ITEM" };

    const account = this.accounts.get(request.playerId);
    if (!account) return { ok: false, code: "NOT_IN_ROOM" };
    if (account.roomId !== request.roomId) return { ok: false, code: "ROOM_MISMATCH" };

    const existing = account.transactions.get(request.transactionId);
    if (existing) return existing;

    const totalCost = item.price * quantity;
    if (account.coins < totalCost) {
      const failed: EconomyMutationResult = { ok: false, code: "INSUFFICIENT_FUNDS" };
      account.transactions.set(request.transactionId, failed);
      return failed;
    }

    account.coins -= totalCost;
    account.inventory.set(item.id, (account.inventory.get(item.id) ?? 0) + quantity);
    const result: EconomyMutationResult = {
      ok: true,
      coins: account.coins,
      inventory: serializeInventory(account.inventory),
    };
    account.transactions.set(request.transactionId, result);
    this.publish(account);
    return result;
  }

  private publish(account: PlayerEconomy) {
    if (!account.connectionId) return;
    this.options.publish({
      version: PROTOCOL_VERSION,
      roomId: account.roomId,
      playerId: account.playerId,
      coins: account.coins,
      inventory: serializeInventory(account.inventory),
    }, account.connectionId);
  }
}
