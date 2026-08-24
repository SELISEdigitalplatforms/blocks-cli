export type BlocksMfaConfig = Record<string, unknown> & {
  allowBackupCodes?: boolean;
  allowUserOptOut?: boolean;
  backupCodesCount?: number;
  enableMfa?: boolean;
  requireMfaForAllUsers?: boolean;
  userMfaType?: number[];
};

export type BlocksMfaConfigSaveRequest = Record<string, unknown> & {
  allowBackupCodes?: boolean;
  allowUserOptOut?: boolean;
  backupCodesCount?: number;
  enableMfa?: boolean;
  mfaExemptRoles?: string[];
  mfaRequiredRoles?: string[];
  mfaTemplate?: {
    templateId?: string;
    templateName?: string;
  };
  requireMfaForAllUsers?: boolean;
  userMfaType?: number[];
};

export type BlocksMfaGenerateRequest = {
  /** IAM's UserMfaType: 0 None, 1 TOTP, 2 Email, 3 Sms, 4 WhatsApp. Only 1 and 2 have a provider. */
  mfaType: number;
  sendPhoneNumberAsEmailDomain?: string;
};

export type BlocksMfaResendRequest = {
  mfaId: string;
  sendPhoneNumberAsEmailDomain?: string;
};

export type BlocksMfaVerifyRequest = {
  /** Same UserMfaType enum as `mfaType`: the method that issued this challenge (1 TOTP, 2 Email). */
  authType: number;
  isFromTokenCall?: boolean;
  mfaId: string;
  verificationCode: string;
};

export type BlocksMfaSetMethodRequest = {
  mfaType: number;
};

export type BlocksMfaVerifyTotpSetupRequest = {
  code: string;
};

export type BlocksMfaBackupCodeUseRequest = {
  code: string;
  userId: string;
};

export type BlocksMfaPassThroughResponse = Record<string, unknown>;
