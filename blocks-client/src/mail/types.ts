export type BlocksSendMailRequest = {
  attachments?: string[];
  bcc?: string[];
  bodyDataContext?: Record<string, string>;
  cc?: string[];
  language?: string;
  /** Defaults to the tenant's `x-blocks-key` on the server side when omitted. */
  projectKey?: string;
  purpose?: string;
  replyTo?: string[];
  sendPhoneNumberAsEmail?: boolean;
  subjectDataContext?: Record<string, string>;
  to?: string[];
};

export type BlocksSendMailToAnyRequest = BlocksSendMailRequest & {
  isTestMail?: boolean;
};

export type BlocksMailPassThroughResponse = Record<string, unknown>;
