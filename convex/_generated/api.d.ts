/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as bankTransactions from "../bankTransactions.js";
import type * as bankUtils from "../bankUtils.js";
import type * as banks from "../banks.js";
import type * as cities from "../cities.js";
import type * as clearData from "../clearData.js";
import type * as clients from "../clients.js";
import type * as dashboard from "../dashboard.js";
import type * as deliveries from "../deliveries.js";
import type * as feedback from "../feedback.js";
import type * as files from "../files.js";
import type * as finance from "../finance.js";
import type * as interBankTransfers from "../interBankTransfers.js";
import type * as invoices from "../invoices.js";
import type * as migrations from "../migrations.js";
import type * as orders from "../orders.js";
import type * as payments from "../payments.js";
import type * as settings from "../settings.js";
import type * as users from "../users.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  bankTransactions: typeof bankTransactions;
  bankUtils: typeof bankUtils;
  banks: typeof banks;
  cities: typeof cities;
  clearData: typeof clearData;
  clients: typeof clients;
  dashboard: typeof dashboard;
  deliveries: typeof deliveries;
  feedback: typeof feedback;
  files: typeof files;
  finance: typeof finance;
  interBankTransfers: typeof interBankTransfers;
  invoices: typeof invoices;
  migrations: typeof migrations;
  orders: typeof orders;
  payments: typeof payments;
  settings: typeof settings;
  users: typeof users;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
