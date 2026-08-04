import { BlocksHttpClient } from "../http/http-client.js";
import { BlocksMailPassThroughResponse, BlocksSendMailRequest, BlocksSendMailToAnyRequest } from "./types.js";

const MAIL_API = "/logic/v4/Mail";

/**
 * Mail sending surface: fires a purpose/language-templated email through the tenant's
 * configured mail provider. Mail server/template/mailbox management (Mail/Save, Mail/Get,
 * templates, mailbox reads) is a CLI/admin concern and is not exposed here.
 */
export class BlocksMailClient {
  constructor(private readonly http: BlocksHttpClient) {}

  /**
   * What: sends an email through `POST /logic/v4/Mail/Send` using the tenant's default mail configuration.
   * Why: app code needs to trigger transactional email (welcome, password reset, alerts) without managing SMTP directly.
   * How: pass recipients plus `purpose`/`language` to select the right template, and `subjectDataContext`/`bodyDataContext` for placeholder values.
   */
  send(request: BlocksSendMailRequest): Promise<BlocksMailPassThroughResponse> {
    return this.http.request<BlocksMailPassThroughResponse>(`${MAIL_API}/Send`, { body: request });
  }

  /**
   * What: sends an email through `POST /logic/v4/Mail/SendToAny`.
   * Why: some sends need a provider-routing hint the default `send` doesn't take, such as marking a test send.
   * How: same fields as `send`, plus `isTestMail`.
   */
  sendToAny(request: BlocksSendMailToAnyRequest): Promise<BlocksMailPassThroughResponse> {
    return this.http.request<BlocksMailPassThroughResponse>(`${MAIL_API}/SendToAny`, { body: request });
  }
}
