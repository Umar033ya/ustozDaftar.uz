export type PlanId = "free" | "pro" | "max";
export type BillingPeriod = "monthly" | "yearly";
export type PaymentStatus = "pending" | "approved" | "rejected";
export type AuditAction =
  | "payment.approve"
  | "payment.reject"
  | "subscription.set";

export type AssessmentType = "BSB" | "ChSB";

/** Workspace counters of one teacher (classes, students, assessments). */
export interface WorkspaceCounts {
  classCount: number;
  studentCount: number;
  bsbCount: number;
  chsbCount: number;
  assessmentCount: number;
  /** Latest class/assessment creation time — the app records no other activity. */
  lastActivity: number | null;
}

export interface AdminUser extends WorkspaceCounts {
  uid: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  schoolName?: string;
  createdAt?: number | null;
  plan: PlanId;
  planExpiry?: number | null;
  hasUpcomingPayments: boolean;
}

export interface WorkspaceStudent {
  id: string;
  name: string;
  createdAt: number;
}

export interface WorkspaceClass {
  id: string;
  name: string;
  academicYear: string;
  createdAt: number | null;
  students: WorkspaceStudent[];
}

export interface WorkspaceResult {
  studentId: string;
  studentName: string;
  /** BSB task scores; null = not entered. Empty for ChSB. */
  scores: (number | null)[];
  total: number | null;
  percentage: number | null;
}

export interface WorkspaceAssessment {
  id: string;
  type: AssessmentType;
  classId: string;
  className: string;
  academicYear: string;
  subject: string;
  number: string | null;
  date: string;
  maxScore: number | null;
  taskMaxScores: (number | null)[];
  createdAt: number | null;
  results: WorkspaceResult[];
  enteredCount: number;
  averagePercentage: number | null;
}

export interface UserWorkspace {
  counts: WorkspaceCounts;
  classes: WorkspaceClass[];
  assessments: WorkspaceAssessment[];
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
  /** Platform-wide workspace totals. */
  totalClasses: number;
  totalStudents: number;
  totalBsb: number;
  totalChsb: number;
  /** Users with at least one class. */
  teachersWithClasses: number;
}