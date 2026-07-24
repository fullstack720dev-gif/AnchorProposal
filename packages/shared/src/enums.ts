export enum UserRole {
  MASTER = 'MASTER',
  ADMIN = 'ADMIN',
  BIDDER = 'BIDDER',
}

export enum UserStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export enum AuthChallengePurpose {
  SIGNUP = 'SIGNUP',
  LOGIN = 'LOGIN',
  RESET = 'RESET',
}

export enum ApplicationStatus {
  SAVED = 'SAVED',
  /** @deprecated Prefer SAVED — kept for DB compatibility */
  READY_TO_APPLY = 'READY_TO_APPLY',
  APPLIED = 'APPLIED',
  /** @deprecated Prefer APPLIED — kept for DB compatibility */
  RECRUITER_CONTACTED = 'RECRUITER_CONTACTED',
  ASSESSMENT = 'ASSESSMENT',
  INTERVIEW = 'INTERVIEW',
  OFFER = 'OFFER',
  REJECTED = 'REJECTED',
  WITHDRAWN = 'WITHDRAWN',
  CLOSED = 'CLOSED',
}

export enum GenerationStatus {
  QUEUED = 'QUEUED',
  VALIDATING = 'VALIDATING',
  GENERATING = 'GENERATING',
  RENDERING = 'RENDERING',
  UPLOADING = 'UPLOADING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum WarningSeverity {
  INFO = 'INFO',
  CONFIRM = 'CONFIRM',
  ADMIN_REVIEW = 'ADMIN_REVIEW',
  BLOCK = 'BLOCK',
}

export enum WarningBehavior {
  WARN = 'WARN',
  CONFIRM = 'CONFIRM',
  ADMIN_REVIEW = 'ADMIN_REVIEW',
  BLOCK = 'BLOCK',
}

export enum WarningCategory {
  REMOTE_CONFLICT = 'REMOTE_CONFLICT',
  CLEARANCE = 'CLEARANCE',
  TRUST_BACKGROUND = 'TRUST_BACKGROUND',
  CITIZENSHIP = 'CITIZENSHIP',
  TRAVEL_LOCATION = 'TRAVEL_LOCATION',
  DUPLICATE = 'DUPLICATE',
}

export enum FileType {
  PDF = 'PDF',
  DOCX = 'DOCX',
  TXT = 'TXT',
}

export enum WorkArrangement {
  REMOTE = 'REMOTE',
  HYBRID = 'HYBRID',
  ONSITE = 'ONSITE',
  UNKNOWN = 'UNKNOWN',
}

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  [ApplicationStatus.SAVED]: 'Saved',
  [ApplicationStatus.READY_TO_APPLY]: 'Saved',
  [ApplicationStatus.APPLIED]: 'Applied',
  [ApplicationStatus.RECRUITER_CONTACTED]: 'Applied',
  [ApplicationStatus.ASSESSMENT]: 'Assessment',
  [ApplicationStatus.INTERVIEW]: 'Interview',
  [ApplicationStatus.OFFER]: 'Offer',
  [ApplicationStatus.REJECTED]: 'Rejected',
  [ApplicationStatus.WITHDRAWN]: 'Withdrawn',
  [ApplicationStatus.CLOSED]: 'Closed',
};

/** Canonical pipeline statuses shared by dashboard filters and applications UI. */
export const APPLICATION_PIPELINE_STATUSES = [
  ApplicationStatus.SAVED,
  ApplicationStatus.APPLIED,
  ApplicationStatus.ASSESSMENT,
  ApplicationStatus.INTERVIEW,
  ApplicationStatus.OFFER,
  ApplicationStatus.REJECTED,
  ApplicationStatus.WITHDRAWN,
  ApplicationStatus.CLOSED,
] as const;

export type ApplicationPipelineStatus = (typeof APPLICATION_PIPELINE_STATUSES)[number];

/** Map legacy statuses onto the current pipeline. */
export function normalizeApplicationStatus(status: string): ApplicationPipelineStatus | string {
  if (status === ApplicationStatus.READY_TO_APPLY) return ApplicationStatus.SAVED;
  if (status === ApplicationStatus.RECRUITER_CONTACTED) return ApplicationStatus.APPLIED;
  return status;
}
