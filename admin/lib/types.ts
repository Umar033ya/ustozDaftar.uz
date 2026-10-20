export type PlanId = "free" | "pro" | "max";
export type BillingPeriod = "monthly" | "yearly";
export type PaymentStatus = "pending" | "approved" | "rejected";
export type AuditAction =
  | "payment.approve"
  | "payment.reject"
  | "subscription.set";

export interface AdminUser {
  uid: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  schoolName?: string;
  createdAt?: number | null;
  plan: PlanId;
  planExpiry?: number | null;
  classCount: number;
  assessmentCount: number;
  hasUpcomingPayments: boolean;
}

export interface PaymentRequest {
  id: string;
  uid: string;
  userName?: string;
  userEmail?: string;
  plan: PlanId;
  billingPeriod: BillingPeriod;
  amount?: string;
  cardLastFour?: string;
  cardholderName?: string;
  paymentDateTime?: string;
  status: PaymentStatus;
  createdAt?: number | null;
  processedAt?: number | null;
  processedBy?: string;
}

export interface AuditLog {
  id: string;
  action: AuditAction;
  actorUid: string;
  actorEmail?: string;
  targetUid?: string;
  targetEmail?: string;
  details?: Record<string, unknown>;
  createdAt: number;
}

export interface PlanDistribution {
  free: number;
  pro: number;
  max: number;
}

export interface OverviewStats {
  totalUsers: number;
  newUsers30d: number;
  activeSubscriptions: number;
  pendingPayments: number;
  approvedPayments: number;
  rejectedPayments: number;
  revenueEstimate: number;
  planDistribution: PlanDistribution;
  recentPayments: PaymentRequest[];
}