import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from './axios';
import { getApiErrorMessage } from '@/lib/apiError';
import type { DeviceSettingsChecklistItem, ChecklistItemReviewStatus } from '@/constants/deviceSettingsChecklist';

type ApiResponse<T> = { success: boolean; data: T; error: string | null };

async function handleApi<T>(
  fn: () => Promise<{ data: ApiResponse<T> }>,
  fallback: string
): Promise<T> {
  try {
    const { data } = await fn();
    if (!data.success || data.data == null) throw new Error(data.error ?? fallback);
    return data.data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err, fallback));
  }
}

export type PersonnelTaskStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'AWAITING_REVIEW'
  | 'COMPLETE'
  | 'OVERDUE'
  | 'REJECTED';

export type PersonnelTaskType =
  | 'DEVICE_SETTINGS'
  | 'POLICY_ACK'
  | 'BACKGROUND_CHECK'
  | 'TRAINING';

export type PersonnelTaskUser = {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status: string;
};

export type PersonnelTask = {
  id: string;
  source: 'POLICY' | 'DEVICE' | 'REQUIREMENT' | 'TRAINING';
  title: string;
  description?: string;
  type: PersonnelTaskType;
  lifecycle: 'ONBOARDING' | 'RECURRING' | 'OFFBOARDING';
  assignedTo: 'EMPLOYEE' | 'ADMIN';
  cycleKey: string;
  status: PersonnelTaskStatus;
  dueDate?: string | null;
  completedAt?: string | null;
  policyId?: string;
  policyVersionId?: string;
  deviceId?: string;
  requirementId?: string;
  trainingModuleId?: string;
  metadata?: Record<string, unknown>;
};

export type PersonnelTaskSummary = {
  total: number;
  complete: number;
  overdue: number;
  awaitingReview: number;
  [key: string]: number;
};

export type MyPersonnelTasks = {
  user: PersonnelTaskUser;
  tasks: PersonnelTask[];
  summary: PersonnelTaskSummary;
};

export type AdminPersonTaskRow = {
  user: PersonnelTaskUser;
  summary: PersonnelTaskSummary;
  percentComplete: number;
};

export type AdminTaskSummaryRow = {
  key: string;
  title: string;
  type: PersonnelTaskType;
  assigned: number;
  complete: number;
  overdue: number;
  awaitingReview: number;
};

export type ReviewQueueChecklistItem = DeviceSettingsChecklistItem & {
  status: ChecklistItemReviewStatus;
  evidenceFile?: {
    _id: string;
    originalName?: string;
    mimeType?: string;
    sizeBytes?: number | null;
  } | null;
};

export type ReviewQueueItem = {
  id: string;
  type: PersonnelTaskType;
  title: string;
  submittedAt?: string;
  user: PersonnelTaskUser | null;
  evidence?: {
    id: string;
    deviceId?: string | null;
    checklistItems?: ReviewQueueChecklistItem[];
  };
  metadata?: Record<string, unknown>;
};

export type TrainingQuestion = {
  id: string;
  text: string;
  topic?: string;
  difficulty?: string;
  options: Array<{ id: string; text: string }>;
};

export type TrainingQuizSessionSummary = {
  status: 'not_started' | 'in_progress' | 'submitted';
  selectedQuestionIds: string[];
  startedAt?: string | null;
  submittedAt?: string | null;
  scorePercent?: number | null;
  correctCount?: number | null;
  totalQuestions?: number | null;
};

export type TrainingQuizMeta = {
  passingScore: number;
  maxAttempts: number;
  retryDelayHours: number;
  questionsPerAttempt: number;
  totalQuestionBank: number;
};

export type TrainingAttemptSummary = {
  cycleKey: string;
  readProgressPercent: number;
  readCompletedAt?: string | null;
  quizScore?: number | null;
  attempts: number;
  nextRetryAt?: string | null;
  passedAt?: string | null;
  certificateEvidenceId?: string | null;
  quizSession: TrainingQuizSessionSummary;
  quizMeta: TrainingQuizMeta;
};

export type TrainingModuleDetail = {
  _id: string;
  moduleKey: string;
  version: number;
  title: string;
  description?: string;
  frameworkTags: string[];
  estimatedReadMinutes?: number | null;
  contentMarkdown: string;
  attempt: TrainingAttemptSummary;
};

export type TrainingQuizStartResponse = {
  sessionId: string;
  status: TrainingQuizSessionSummary['status'];
  startedAt?: string | null;
  submittedAt?: string | null;
  questions: TrainingQuestion[];
  meta: {
    passingScore: number;
    questionsPerAttempt: number;
    maxAttempts: number;
    retryDelayHours: number;
  };
  attempt: TrainingAttemptSummary;
};

export type TrainingQuizReviewItem = TrainingQuestion & {
  selectedOptionId: string | null;
  isCorrect: boolean;
  explanation: string;
  correctOptionId: string;
};

export type TrainingQuizResult = {
  passed: boolean;
  scorePercent: number;
  correctCount: number;
  totalQuestions: number;
  passingScore: number;
  canRetake: boolean;
  nextRetryAt?: string | null;
  attempts: number;
  maxAttempts: number;
  review: TrainingQuizReviewItem[];
  attempt: TrainingAttemptSummary;
};

export function useMyPersonnelTasks() {
  return useQuery({
    queryKey: ['personnel-tasks', 'my'],
    queryFn: () =>
      handleApi(
        () => api.get<ApiResponse<MyPersonnelTasks>>('/personnel-tasks/my'),
        'Unable to load personnel tasks.'
      ),
  });
}

export function useAdminPersonnelPeople(enabled = true) {
  return useQuery({
    queryKey: ['personnel-tasks', 'admin', 'people'],
    queryFn: () =>
      handleApi(
        () => api.get<ApiResponse<AdminPersonTaskRow[]>>('/personnel-tasks/admin/people'),
        'Unable to load personnel task people.'
      ),
    enabled,
  });
}

export function useAdminPersonnelTasks(enabled = true) {
  return useQuery({
    queryKey: ['personnel-tasks', 'admin', 'tasks'],
    queryFn: () =>
      handleApi(
        () => api.get<ApiResponse<AdminTaskSummaryRow[]>>('/personnel-tasks/admin/tasks'),
        'Unable to load personnel task summary.'
      ),
    enabled,
  });
}

export function usePersonnelReviewQueue(enabled = true) {
  return useQuery({
    queryKey: ['personnel-tasks', 'admin', 'review-queue'],
    queryFn: () =>
      handleApi(
        () => api.get<ApiResponse<ReviewQueueItem[]>>('/personnel-tasks/admin/review-queue'),
        'Unable to load personnel review queue.'
      ),
    enabled,
  });
}

export function useReviewDeviceSubmission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ evidenceId, status, note }: { evidenceId: string; status: 'APPROVED' | 'REJECTED'; note?: string }) =>
      handleApi(
        () =>
          api.post<ApiResponse<unknown>>(`/personnel-tasks/admin/device-submissions/${evidenceId}/review`, {
            status,
            note,
          }),
        'Unable to review device submission.'
      ),
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['personnel-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      toast.success(status === 'APPROVED' ? 'Device submission approved' : 'Device submission rejected');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useTrainingModule(moduleId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['personnel-tasks', 'training', moduleId],
    queryFn: () =>
      handleApi(
        () => api.get<ApiResponse<TrainingModuleDetail>>(`/personnel-tasks/training/${moduleId}`),
        'Unable to load training module.'
      ),
    enabled: !!moduleId && enabled,
  });
}

export function useUpdateTrainingProgress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ moduleId, readProgressPercent }: { moduleId: string; readProgressPercent: number }) =>
      handleApi(
        () =>
          api.post<ApiResponse<TrainingModuleDetail>>(`/personnel-tasks/training/${moduleId}/progress`, {
            readProgressPercent,
          }),
        'Unable to update training progress.'
      ),
    onSuccess: (_, { moduleId }) => {
      queryClient.invalidateQueries({ queryKey: ['personnel-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['personnel-tasks', 'training', moduleId] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useStartTrainingQuiz() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ moduleId, forceNew = false }: { moduleId: string; forceNew?: boolean }) =>
      handleApi(
        () =>
          api.post<ApiResponse<TrainingQuizStartResponse>>(
            `/personnel-tasks/training/${moduleId}/quiz/start`,
            { forceNew }
          ),
        'Unable to start training quiz.'
      ),
    onSuccess: (_, { moduleId }) => {
      queryClient.invalidateQueries({ queryKey: ['personnel-tasks', 'training', moduleId] });
      queryClient.invalidateQueries({ queryKey: ['personnel-tasks', 'training', moduleId, 'quiz'] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useSubmitTrainingQuiz() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ moduleId, answers }: { moduleId: string; answers: Record<string, string> }) =>
      handleApi(
        () =>
          api.post<ApiResponse<TrainingQuizResult>>(
            `/personnel-tasks/training/${moduleId}/quiz/submit`,
            { answers }
          ),
        'Unable to submit training quiz.'
      ),
    onSuccess: (result, { moduleId }) => {
      queryClient.invalidateQueries({ queryKey: ['personnel-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['personnel-tasks', 'training', moduleId] });
      queryClient.invalidateQueries({ queryKey: ['personnel-tasks', 'training', moduleId, 'quiz'] });
      if (result.passed) {
        toast.success('Training completed');
      } else {
        toast.error('Quiz not passed. Review your answers and try again when eligible.');
      }
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useTrainingQuizResult(moduleId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['personnel-tasks', 'training', moduleId, 'quiz', 'result'],
    queryFn: () =>
      handleApi(
        () =>
          api.get<ApiResponse<TrainingQuizResult>>(
            `/personnel-tasks/training/${moduleId}/quiz/result`
          ),
        'Unable to load quiz result.'
      ),
    enabled: !!moduleId && enabled,
    retry: false,
  });
}

function parseFilenameFromContentDisposition(header?: string): string | null {
  if (!header) return null;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1]);
    } catch {
      return utf8[1];
    }
  }
  const basic = /filename="([^"]+)"/i.exec(header);
  return basic?.[1] ?? null;
}

/** Streams certificate through API — never exposes S3/storage URLs to the browser. */
export async function fetchTrainingCertificateFile(
  moduleId: string,
  disposition: 'inline' | 'attachment' = 'attachment'
): Promise<{ blob: Blob; fileName: string }> {
  try {
    const response = await api.get(`/personnel-tasks/training/${moduleId}/certificate/file`, {
      responseType: 'blob',
      params: { disposition },
    });
    const fileName =
      parseFilenameFromContentDisposition(
        response.headers['content-disposition'] as string | undefined
      ) || 'training-certificate.txt';
    return { blob: response.data as Blob, fileName };
  } catch (err) {
    throw new Error(getApiErrorMessage(err, 'Unable to load certificate.'));
  }
}
