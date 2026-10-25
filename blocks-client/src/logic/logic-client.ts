import { BlocksHttpClient } from "../http/http-client.js";
import { BlocksFunctionsClient } from "./functions-client.js";
import { BlocksProxyClient } from "./proxy-client.js";

/**
 * blocks-logic runtime surface for app code: invoking deployed functions and calling
 * third-party APIs through proxies. Authoring and administering both -- and workflows,
 * schedules -- is CLI work.
 */
export class BlocksLogicClient {
  readonly functions: BlocksFunctionsClient;
  readonly proxy: BlocksProxyClient;

  constructor(http: BlocksHttpClient, apiUrl: string) {
    this.functions = new BlocksFunctionsClient(http, apiUrl);
    this.proxy = new BlocksProxyClient(http, apiUrl);
  }
}
