import type { GbpConnection } from "@/audit/types";
import { authHeadersForConnection } from "./auth-headers";
import { analyzeGbpLocalPostCoverage } from "./gbp-local-posts-coverage";
import { sanitizeGbpPostSummary } from "./gbp-post-content";

const GBP_V4 = "https://mybusiness.googleapis.com/v4";

export type GbpLocalPostTopicType = "STANDARD" | "EVENT" | "OFFER" | "ALERT";
export type GbpLocalPostState = "LIVE" | "PROCESSING" | "REJECTED" | "LOCAL_POST_STATE_UNSPECIFIED";
export type GbpLocalPostActionType =
  | "BOOK"
  | "ORDER"
  | "SHOP"
  | "LEARN_MORE"
  | "SIGN_UP"
  | "CALL"
  | "ACTION_TYPE_UNSPECIFIED";

export interface GbpLocalPostCallToAction {
  actionType: GbpLocalPostActionType;
  url?: string;
}

export interface GbpLocalPostDate {
  year: number;
  month: number;
  day: number;
}

export interface GbpLocalPostTimeOfDay {
  hours: number;
  minutes?: number;
  seconds?: number;
}

export interface GbpLocalPostTimeInterval {
  startDate: GbpLocalPostDate;
  startTime?: GbpLocalPostTimeOfDay;
  endDate: GbpLocalPostDate;
  endTime?: GbpLocalPostTimeOfDay;
}

export interface GbpLocalPostEvent {
  title: string;
  schedule: GbpLocalPostTimeInterval;
}

export interface GbpLocalPostOffer {
  couponCode?: string;
  redeemOnlineUrl?: string;
  termsConditions?: string;
}

export interface GbpLocalPostMedia {
  sourceUrl: string;
}

export interface GbpLocalPost {
  name: string;
  languageCode?: string;
  summary: string;
  topicType: GbpLocalPostTopicType;
  state?: GbpLocalPostState;
  createTime?: string;
  updateTime?: string;
  searchUrl?: string;
  callToAction?: GbpLocalPostCallToAction;
  event?: GbpLocalPostEvent;
  offer?: GbpLocalPostOffer;
  media?: GbpLocalPostMedia[];
  alertType?: string;
}

export interface GbpLocalPostMetricValue {
  metric?: string;
  totalValue?: { metricOption?: string; timeDimension?: { timeRange?: unknown }; value?: string };
  dimensionalValues?: Array<{
    metricOption?: string;
    value?: string;
    timeDimension?: { timeRange?: unknown };
  }>;
}

export interface GbpLocalPostInsights {
  localPostName: string;
  metricValues: GbpLocalPostMetricValue[];
}

export type LocalPostEndpointStatus = "ok" | "failed" | "denied" | "skipped";

export interface LocalPostsApiProbe {
  ok: boolean;
  error?: string;
  permissionDenied: boolean;
  partial?: boolean;
  postCount?: number;
  endpoints?: {
    list: LocalPostEndpointStatus;
    insights: LocalPostEndpointStatus;
  };
  coverage?: ReturnType<typeof analyzeGbpLocalPostCoverage>;
}

const TOPIC_TYPE_LABELS: Record<GbpLocalPostTopicType, string> = {
  STANDARD: "Update",
  EVENT: "Event",
  OFFER: "Offer",
  ALERT: "Alert",
};

const ACTION_TYPE_LABELS: Record<GbpLocalPostActionType, string> = {
  BOOK: "Book",
  ORDER: "Order",
  SHOP: "Shop",
  LEARN_MORE: "Learn more",
  SIGN_UP: "Sign up",
  CALL: "Call",
  ACTION_TYPE_UNSPECIFIED: "Unspecified",
};

export function localPostTopicLabel(topicType: GbpLocalPostTopicType | string): string {
  return TOPIC_TYPE_LABELS[topicType as GbpLocalPostTopicType] ?? String(topicType);
}

export function localPostActionLabel(actionType: GbpLocalPostActionType | string): string {
  return ACTION_TYPE_LABELS[actionType as GbpLocalPostActionType] ?? String(actionType);
}

function normalizeAccountId(accountId: string): string {
  return accountId.replace(/^accounts\//, "");
}

function normalizeLocationId(locationId: string): string {
  return locationId.replace(/^locations\//, "");
}

function localPostsParent(connection: GbpConnection): string {
  return `accounts/${normalizeAccountId(connection.accountId)}/locations/${normalizeLocationId(connection.locationId)}`;
}

async function throwApiError(res: Response, data: unknown, fallback: string): Promise<never> {
  const message =
    (data as { error?: { message?: string } })?.error?.message ?? `${fallback} (${res.status})`;
  const err = new Error(message) as Error & { httpStatus?: number };
  err.httpStatus = res.status;
  throw err;
}

function endpointStatusFromError(error: unknown): LocalPostEndpointStatus {
  const httpStatus = (error as Error & { httpStatus?: number }).httpStatus;
  if (httpStatus === 403 || httpStatus === 401) return "denied";
  return "failed";
}

function normalizeLocalPost(data: Partial<GbpLocalPost>): GbpLocalPost {
  return {
    name: data.name ?? "",
    languageCode: data.languageCode,
    summary: data.summary ?? "",
    topicType: (data.topicType ?? "STANDARD") as GbpLocalPostTopicType,
    state: data.state as GbpLocalPostState | undefined,
    createTime: data.createTime,
    updateTime: data.updateTime,
    searchUrl: data.searchUrl,
    callToAction: data.callToAction,
    event: data.event,
    offer: data.offer,
    media: data.media,
    alertType: data.alertType,
  };
}

/** accounts.locations.localPosts.list */
export async function listGbpLocalPosts(connection: GbpConnection): Promise<GbpLocalPost[]> {
  const parent = localPostsParent(connection);
  const posts: GbpLocalPost[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${GBP_V4}/${parent}/localPosts`);
    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString(), {
      headers: authHeadersForConnection(connection),
    });
    const data = (await res.json()) as {
      localPosts?: Partial<GbpLocalPost>[];
      nextPageToken?: string;
      error?: { message?: string };
    };

    if (!res.ok) {
      await throwApiError(res, data, "Local posts list failed");
    }

    posts.push(...(data.localPosts ?? []).map(normalizeLocalPost));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return posts;
}

/** accounts.locations.localPosts.get */
export async function getGbpLocalPost(
  connection: GbpConnection,
  postName: string
): Promise<GbpLocalPost> {
  const name = postName.includes("/")
    ? postName
    : `${localPostsParent(connection)}/localPosts/${postName}`;

  const res = await fetch(`${GBP_V4}/${name}`, {
    headers: authHeadersForConnection(connection),
  });
  const data = (await res.json()) as Partial<GbpLocalPost> & { error?: { message?: string } };

  if (!res.ok) {
    await throwApiError(res, data, "Local post fetch failed");
  }

  return normalizeLocalPost(data);
}

export interface CreateGbpLocalPostInput {
  summary: string;
  topicType?: GbpLocalPostTopicType;
  languageCode?: string;
  callToAction?: GbpLocalPostCallToAction;
  event?: GbpLocalPostEvent;
  offer?: GbpLocalPostOffer;
  media?: GbpLocalPostMedia[];
  alertType?: string;
}

/** accounts.locations.localPosts.create */
export async function createGbpLocalPost(
  connection: GbpConnection,
  input: CreateGbpLocalPostInput
): Promise<GbpLocalPost> {
  // Google rejects posts with phone numbers or URLs in the summary — links
  // belong in callToAction.url and calls go through the verified number.
  const trimmed = sanitizeGbpPostSummary(input.summary).text;
  if (!trimmed) throw new Error("Post summary cannot be empty.");

  const topicType = input.topicType ?? "STANDARD";
  const body: Record<string, unknown> = {
    languageCode: input.languageCode ?? "en",
    summary: trimmed,
    topicType,
  };

  if (topicType !== "OFFER" && input.callToAction) {
    body.callToAction = input.callToAction;
  } else if (topicType === "STANDARD" && !input.callToAction) {
    body.callToAction = { actionType: "CALL" };
  }

  if (input.event) body.event = input.event;
  if (input.offer) body.offer = input.offer;
  if (input.media?.length) body.media = input.media;
  if (input.alertType) body.alertType = input.alertType;

  const res = await fetch(`${GBP_V4}/${localPostsParent(connection)}/localPosts`, {
    method: "POST",
    headers: {
      ...authHeadersForConnection(connection),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as Partial<GbpLocalPost> & { error?: { message?: string } };

  if (!res.ok) {
    await throwApiError(res, data, "Local post create failed");
  }

  return normalizeLocalPost(data);
}

/** accounts.locations.localPosts.patch */
export async function patchGbpLocalPost(
  connection: GbpConnection,
  post: Pick<GbpLocalPost, "name"> &
    Partial<Pick<GbpLocalPost, "summary" | "callToAction" | "event" | "offer" | "media">>,
  updateMask: string[]
): Promise<GbpLocalPost> {
  const url = new URL(`${GBP_V4}/${post.name}`);
  url.searchParams.set("updateMask", updateMask.join(","));

  const res = await fetch(url.toString(), {
    method: "PATCH",
    headers: {
      ...authHeadersForConnection(connection),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: post.name,
      summary: post.summary,
      callToAction: post.callToAction,
      event: post.event,
      offer: post.offer,
      media: post.media,
    }),
  });
  const data = (await res.json()) as Partial<GbpLocalPost> & { error?: { message?: string } };

  if (!res.ok) {
    await throwApiError(res, data, "Local post update failed");
  }

  return normalizeLocalPost(data);
}

/** accounts.locations.localPosts.delete */
export async function deleteGbpLocalPost(
  connection: GbpConnection,
  postName: string
): Promise<void> {
  const name = postName.includes("/")
    ? postName
    : `${localPostsParent(connection)}/localPosts/${postName}`;

  const res = await fetch(`${GBP_V4}/${name}`, {
    method: "DELETE",
    headers: authHeadersForConnection(connection),
  });

  if (res.status === 404) return;

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    await throwApiError(res, data, "Local post delete failed");
  }
}

/** accounts.locations.localPosts.reportInsights */
export async function reportGbpLocalPostInsights(
  connection: GbpConnection,
  localPostNames: string[],
  options?: { days?: number }
): Promise<GbpLocalPostInsights[]> {
  const names = localPostNames.slice(0, 100);
  if (names.length === 0) return [];

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (options?.days ?? 90));

  const res = await fetch(
    `${GBP_V4}/${localPostsParent(connection)}/localPosts:reportInsights`,
    {
      method: "POST",
      headers: {
        ...authHeadersForConnection(connection),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        localPostNames: names,
        basicRequest: {
          metricRequests: [{ metric: "ALL", options: ["AGGREGATED_TOTAL"] }],
          timeRange: {
            startTime: start.toISOString(),
            endTime: end.toISOString(),
          },
        },
      }),
    }
  );

  const data = (await res.json()) as {
    localPostMetrics?: GbpLocalPostInsights[];
    error?: { message?: string };
  };

  if (!res.ok) {
    await throwApiError(res, data, "Local post insights failed");
  }

  return data.localPostMetrics ?? [];
}

async function probeEndpoint(probe: () => Promise<unknown>): Promise<LocalPostEndpointStatus> {
  try {
    await probe();
    return "ok";
  } catch (error) {
    return endpointStatusFromError(error);
  }
}

/** Quick health check for settings and onboarding. */
export async function probeLocalPostsApiAccess(
  connection: GbpConnection
): Promise<LocalPostsApiProbe> {
  const endpoints = {
    list: await probeEndpoint(() => listGbpLocalPosts(connection)),
    insights: "skipped" as LocalPostEndpointStatus,
  };

  if (endpoints.list !== "ok") {
    return {
      ok: false,
      permissionDenied: endpoints.list === "denied",
      error:
        endpoints.list === "denied"
          ? "Local Posts API access denied for this location."
          : "Local Posts API unavailable for this location.",
      endpoints,
    };
  }

  try {
    const posts = await listGbpLocalPosts(connection);

    if (posts.length > 0) {
      endpoints.insights = await probeEndpoint(() =>
        reportGbpLocalPostInsights(
          connection,
          posts.slice(0, 3).map((post) => post.name)
        )
      );
    }

    const coverage = analyzeGbpLocalPostCoverage({ posts, probe: { endpoints } });

    return {
      ok: true,
      permissionDenied: false,
      partial: endpoints.insights !== "ok" && posts.length > 0,
      postCount: posts.length,
      endpoints,
      coverage,
    };
  } catch (error) {
    return {
      ok: false,
      permissionDenied: endpointStatusFromError(error) === "denied",
      error: error instanceof Error ? error.message : "Local Posts API probe failed",
      endpoints,
    };
  }
}

export const LOCAL_POSTS_METHODS = [
  "accounts.locations.localPosts.create",
  "accounts.locations.localPosts.delete",
  "accounts.locations.localPosts.get",
  "accounts.locations.localPosts.list",
  "accounts.locations.localPosts.patch",
  "accounts.locations.localPosts.reportInsights",
] as const;

export const LOCAL_POST_TOPIC_TYPES: GbpLocalPostTopicType[] = [
  "STANDARD",
  "EVENT",
  "OFFER",
  "ALERT",
];

export const LOCAL_POST_ACTION_TYPES: GbpLocalPostActionType[] = [
  "BOOK",
  "ORDER",
  "SHOP",
  "LEARN_MORE",
  "SIGN_UP",
  "CALL",
];
