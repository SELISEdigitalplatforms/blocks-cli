export type BlocksNotifierSubscriptionFilter = {
  actionName?: string;
  context?: string;
  value?: string;
};

export type BlocksNotifyRequest = {
  configurationName?: string;
  connectionId?: string;
  contentAvailable?: boolean;
  denormalizedPayload?: string;
  responseKey?: string;
  responseValue?: string;
  roles?: string[];
  saveDenormalizedPayloadAsAnObject?: boolean;
  subscriptionFilters?: BlocksNotifierSubscriptionFilter[];
  userIds?: string[];
};

export type BlocksGetUnreadNotificationsBySubscriptionFilterRequest = {
  /** IAM/Notifier-defined order enum (its meanings aren't in the swagger contract -- treat as opaque). */
  orderBy?: 1 | 2;
  subscriptionFilterData?: BlocksNotifierSubscriptionFilter;
  userId?: string;
};

export type BlocksGetNotificationsOptions = {
  filter?: string;
  isUnreadOnly?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDescending?: boolean;
};

export type BlocksOfflineNotification = Record<string, unknown> & {
  correlationId?: string;
  createdTime?: string;
  denormalizedPayload?: string;
  id?: string;
  isRead?: boolean;
  payload?: string;
  readByRoles?: string[];
  readByUserIds?: string[];
};

export type BlocksGetNotificationsResponse = {
  notifications: Record<string, unknown>[];
  totalNotificationsCount: number;
  unReadNotificationsCount: number;
};

export type BlocksMarkNotificationAsReadRequest = {
  id: string;
};

export type BlocksNotifierPassThroughResponse = Record<string, unknown>;
