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
  /** IAM-defined numeric MFA method (its enum names aren't in the swagger contract -- treat as opaque). */
  mfaType: number;
  sendPhoneNumberAsEmailDomain?: string;
};

export type BlocksMfaResendRequest = {
  mfaId: string;
  sendPhoneNumberAsEmailDomain?: string;
};

export type BlocksMfaVerifyRequest = {
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
