import { BlocksHttpClient } from "../http/http-client.js";
import {
  BlocksGetNotificationsOptions,
  BlocksGetNotificationsResponse,
  BlocksGetUnreadNotificationsBySubscriptionFilterRequest,
  BlocksMarkNotificationAsReadRequest,
  BlocksNotifierPassThroughResponse,
  BlocksNotifyRequest,
  BlocksOfflineNotification
} from "./types.js";

const NOTIFIER_API = "/logic/v4/Notifier";

/**
 * Real-time/offline notification surface: push a notification to specific users, roles, or
 * subscription-filter matches, and read/manage the signed-in user's own notification inbox.
 * Tenant-wide notification *channel configuration* (Notification/Save etc., under
 * `BlocksIAMClient`/CLI `notification` commands) is a separate, admin-facing concern.
 */
export class BlocksNotifierClient {
  constructor(private readonly http: BlocksHttpClient) {}

  /**
   * What: pushes a notification through `POST /logic/v4/Notifier/Notify`.
   * Why: app code needs to notify specific users/roles, or everyone subscribed to a filter, in real time with an offline/persisted fallback.
   * How: target with at least one of `userIds`/`roles`/`subscriptionFilters`; set `saveDenormalizedPayloadAsAnObject` if `denormalizedPayload` is a JSON string clients should receive parsed.
   */
  notify(request: BlocksNotifyRequest): Promise<BlocksNotifierPassThroughResponse> {
    return this.http.request<BlocksNotifierPassThroughResponse>(`${NOTIFIER_API}/Notify`, { body: request });
  }

  /**
   * What: reads unread notifications matching a subscription filter through `GET /logic/v4/Notifier/GetUnreadNotificationsBySubscriptionFilter`.
   * Why: clients that subscribe by filter (rather than by user id) need to catch up on what they missed while offline.
   * How: pass `userId` and the same `subscriptionFilterData` shape used with `notify`. Swagger documents this endpoint
   * as GET with a JSON body, which the Fetch spec forbids -- the SDK sends the same fields as a flattened query string instead.
   */
  getUnreadNotificationsBySubscriptionFilter(
    request: BlocksGetUnreadNotificationsBySubscriptionFilterRequest
  ): Promise<BlocksOfflineNotification[]> {
    return this.http.request<BlocksOfflineNotification[]>(`${NOTIFIER_API}/GetUnreadNotificationsBySubscriptionFilter`, {
      query: {
        OrderBy: request.orderBy,
        "SubscriptionFilterData.ActionName": request.subscriptionFilterData?.actionName,
        "SubscriptionFilterData.Context": request.subscriptionFilterData?.context,
        "SubscriptionFilterData.Value": request.subscriptionFilterData?.value,
        UserId: request.userId
      }
    });
  }

  /**
   * What: lists the signed-in user's notifications through `GET /logic/v4/Notifier/GetNotifications`.
   * Why: notification-inbox UIs need paged, sortable, filterable access plus unread/total counts.
   * How: pass paging/sort/filter options; omit them for the API's defaults.
   */
  getNotifications(options: BlocksGetNotificationsOptions = {}): Promise<BlocksGetNotificationsResponse> {
    return this.http.request<BlocksGetNotificationsResponse>(`${NOTIFIER_API}/GetNotifications`, {
      query: {
        Filter: options.filter,
        IsUnreadOnly: options.isUnreadOnly,
        Page: options.page,
        PageSize: options.pageSize,
        "Sort.IsDescending": options.sortDescending,
        "Sort.Property": options.sortBy
      }
    });
  }

  /**
   * What: marks every notification read through `POST /logic/v4/Notifier/MarkAllNotificationAsRead`.
   * Why: inbox UIs offer a bulk "mark all as read" action.
   * How: call with an authorized token for the signed-in user.
   */
  markAllNotificationAsRead(): Promise<BlocksNotifierPassThroughResponse> {
    return this.http.request<BlocksNotifierPassThroughResponse>(`${NOTIFIER_API}/MarkAllNotificationAsRead`, { method: "POST" });
  }

  /**
   * What: marks one notification read through `POST /logic/v4/Notifier/MarkNotificationAsRead`.
   * Why: inbox UIs mark individual notifications read as the user views them.
   * How: pass the notification's `id`.
   */
  markNotificationAsRead(request: BlocksMarkNotificationAsReadRequest): Promise<BlocksNotifierPassThroughResponse> {
    return this.http.request<BlocksNotifierPassThroughResponse>(`${NOTIFIER_API}/MarkNotificationAsRead`, { body: request });
  }
}
