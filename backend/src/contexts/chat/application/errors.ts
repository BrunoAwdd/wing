export class ChatDocumentTooLargeError extends Error {
  constructor(public readonly limit: number) {
    super("chat_document_too_large");
    this.name = "ChatDocumentTooLargeError";
  }
}

export class ChatMessageTooLargeError extends Error {
  constructor(public readonly limit: number) {
    super("chat_message_too_large");
    this.name = "ChatMessageTooLargeError";
  }
}

export class AccountRevokedError extends Error {
  constructor() {
    super("account_revoked");
    this.name = "AccountRevokedError";
  }
}

export class AppSessionExpiredError extends Error {
  constructor() {
    super("app_session_expired");
    this.name = "AppSessionExpiredError";
  }
}

export class ChatSessionNotFoundError extends Error {
  constructor() {
    super("session_not_found");
    this.name = "ChatSessionNotFoundError";
  }
}

export class ChatMessageInProgressError extends Error {
  constructor() {
    super("chat_message_in_progress");
    this.name = "ChatMessageInProgressError";
  }
}

export class ChatMessageLimitError extends Error {
  constructor() {
    super("chat_message_limit");
    this.name = "ChatMessageLimitError";
  }
}

export class QualityLevelRequiresUpgradeError extends Error {
  constructor() {
    super("quality_level_requires_upgrade");
    this.name = "QualityLevelRequiresUpgradeError";
  }
}

export class QuotaExceededError extends Error {
  constructor() {
    super("quota_exceeded");
    this.name = "QuotaExceededError";
  }
}

export class ModelProviderUnavailableError extends Error {
  constructor(
    public readonly model: string,
    public readonly provider: string,
  ) {
    super("model_provider_unavailable");
    this.name = "ModelProviderUnavailableError";
  }
}
