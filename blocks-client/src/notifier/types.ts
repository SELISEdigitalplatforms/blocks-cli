export type BlocksNotifierSubscriptionFilter = {
  actionName?: string;
  context?: string;
  value?: string;
};

export type BlocksNotifyRequest = {
  /**
   * The `name` of one of the tenant's notification configurations (created in the portal or
   * with `blocks notification save`); it decides the channel and who may receive. Required.
   */
  configurationName: string;
  /** The sender's own SignalR connection. Defaults to `"server"` -- a server-side send has none. */
  connectionId?: string;
  contentAvailable?: boolean;
  /** The notification content, usually a JSON string. Required by the service. */
  denormalizedPayload: string;
  /** Members of these organizations receive it. */
  organizationIds?: string[];
  /** Label stored on the notification. Defaults to `"notification"`. */
  responseKey?: string;
  /** Label stored on the notification. Defaults to `"notification"`. */
  responseValue?: string;
  roles?: string[];
  saveDenormalizedPayloadAsAnObject?: boolean;
  subscriptionFilters?: BlocksNotifierSubscriptionFilter[];
  userIds?: string[];
};

export type BlocksGetUnreadNotificationsBySubscriptionFilterRequest = {
  /** 1 = CreatedTime (newest first), 2 = ReadStatus. Any other value (including an omitted 0) returns an empty list. */
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
