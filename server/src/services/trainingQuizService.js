import TrainingModule from '../models/TrainingModule.js';
import TrainingAttempt from '../models/TrainingAttempt.js';
import Evidence from '../models/Evidence.js';
import Organization from '../models/Organization.js';
import { logCrudOperation } from './activityLogger.js';
import { storageService } from './storageService.js';

const DEFAULT_QUESTIONS_PER_ATTEMPT = 6;

function makeError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function addHours(date, hours) {
  const next = new Date(date);
  next.setHours(next.getHours() + Number(hours || 0));
  return next;
}

function escapePdfText(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function createCertificatePdfBuffer({ organizationName, learnerName, email, module, completedAt, score, certificateId }) {
  const lines = [
    { text: 'Certificate of Completion', size: 26, y: 720 },
    { text: organizationName || 'Veraha', size: 14, y: 690 },
    { text: 'This certifies that', size: 13, y: 625 },
    { text: learnerName, size: 22, y: 590 },
    { text: email, size: 11, y: 568 },
    { text: 'has successfully completed', size: 13, y: 525 },
    { text: module.title, size: 18, y: 490 },
    { text: `Module: ${module.moduleKey} v${module.version}`, size: 11, y: 466 },
    { text: `Score: ${Math.round(score * 100)}%`, size: 12, y: 430 },
    { text: `Completed: ${completedAt.toISOString().slice(0, 10)}`, size: 12, y: 408 },
    { text: `Certificate ID: ${certificateId}`, size: 10, y: 360 },
  ];

  const content = [
    'q',
    '0.08 0.38 0.42 RG',
    '3 w',
    '40 40 515 760 re S',
    '0.92 0.97 0.96 rg',
    '55 55 485 730 re f',
    'BT',
    ...lines.flatMap((line) => [
      `/F1 ${line.size} Tf`,
      `1 0 0 1 80 ${line.y} Tm`,
      `(${escapePdfText(line.text)}) Tj`,
    ]),
    'ET',
    'Q',
  ].join('\n');

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n',
    `5 0 obj\n<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream\nendobj\n`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += object;
  }
  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'utf8');
}

function shuffleInPlace(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function mapOptionOrderToObject(optionOrderByQuestion) {
  if (!optionOrderByQuestion) return {};
  if (optionOrderByQuestion instanceof Map) {
    return Object.fromEntries(optionOrderByQuestion.entries());
  }
  return optionOrderByQuestion;
}

function buildOptionOrderForQuestions(questions) {
  const order = {};
  for (const question of questions) {
    order[question.id] = shuffleInPlace(question.options.map((o) => o.id));
  }
  return order;
}

function sanitizeQuestion(question, optionOrder) {
  const byId = new Map(question.options.map((o) => [o.id, o]));
  const ordered = (optionOrder || question.options.map((o) => o.id))
    .map((id) => byId.get(id))
    .filter(Boolean);
  return {
    id: question.id,
    text: question.text,
    topic: question.topic,
    difficulty: question.difficulty,
    options: ordered.map((o) => ({ id: o.id, text: o.text })),
  };
}

function getQuestionsPerAttempt(module) {
  const bank = module.quiz?.questions?.length || 0;
  const requested = module.quiz?.questionsPerAttempt || DEFAULT_QUESTIONS_PER_ATTEMPT;
  return Math.min(requested, bank);
}

function findQuestion(module, questionId) {
  return (module.quiz?.questions || []).find((q) => q.id === questionId);
}

function serializeAttemptSummary(attempt, module) {
  const session = attempt.quizSession || {};
  return {
    cycleKey: attempt.cycleKey,
    readProgressPercent: attempt.readProgressPercent || 0,
    readCompletedAt: attempt.readCompletedAt || null,
    quizScore: attempt.quizScore ?? null,
    attempts: attempt.attempts || 0,
    nextRetryAt: attempt.nextRetryAt || null,
    passedAt: attempt.passedAt || null,
    certificateEvidenceId: attempt.certificateEvidenceId
      ? String(attempt.certificateEvidenceId)
      : null,
    quizSession: {
      status: session.status || 'not_started',
      selectedQuestionIds: session.selectedQuestionIds || [],
      startedAt: session.startedAt || null,
      submittedAt: session.submittedAt || null,
      scorePercent: session.scorePercent ?? null,
      correctCount: session.correctCount ?? null,
      totalQuestions: session.totalQuestions ?? null,
    },
    quizMeta: {
      passingScore: module.quiz?.passingScore ?? 0.8,
      maxAttempts: module.quiz?.maxAttempts ?? 3,
      retryDelayHours: module.quiz?.retryDelayHours ?? 24,
      questionsPerAttempt: getQuestionsPerAttempt(module),
      totalQuestionBank: module.quiz?.questions?.length || 0,
    },
  };
}

async function getOrCreateTrainingAttempt(module, currentUser, cycleKey) {
  return TrainingAttempt.findOneAndUpdate(
    {
      organizationId: currentUser.organizationId,
      userId: currentUser._id,
      moduleId: module._id,
      cycleKey,
    },
    {
      $setOnInsert: {
        organizationId: currentUser.organizationId,
        userId: currentUser._id,
        moduleId: module._id,
        moduleVersion: module.version,
        cycleKey,
      },
    },
    { upsert: true, new: true, runValidators: true }
  );
}

async function generateTrainingCertificateEvidence({ module, attempt, currentUser, score }) {
  if (attempt.certificateEvidenceId) {
    return attempt.certificateEvidenceId;
  }

  const completedAt = attempt.passedAt || new Date();
  const organization = await Organization.findById(currentUser.organizationId).select('name').lean();
  const organizationName = organization?.name || 'Veraha';
  const filename = `training-certificate-${currentUser._id}-${module.moduleKey}-${completedAt.toISOString().slice(0, 10)}.pdf`;
  const buffer = createCertificatePdfBuffer({
    organizationName,
    learnerName: `${currentUser.firstName} ${currentUser.lastName}`,
    email: currentUser.email,
    module,
    completedAt,
    score,
    certificateId: String(attempt._id),
  });
  const uploadResult = await storageService.uploadFile(
    buffer,
    currentUser.organizationId.toString(),
    filename,
    'application/pdf'
  );

  const evidence = await Evidence.create({
    organizationId: currentUser.organizationId,
    title: `Training certificate: ${module.title}`,
    description: `Certificate generated after ${currentUser.firstName} ${currentUser.lastName} passed ${module.title}.`,
    category: 'Training',
    tags: ['training', 'certificate', module.moduleKey],
    source: 'TRAINING_CERTIFICATE',
    externalId: String(attempt._id),
    s3Key: uploadResult.key,
    fileUrl: uploadResult.url,
    fileName: filename,
    mimeType: 'application/pdf',
    sizeBytes: uploadResult.size,
    fileHash: uploadResult.hash,
    uploadedBy: currentUser._id,
    reviewedBy: currentUser._id,
    reviewedAt: completedAt,
    status: 'APPROVED',
    validFrom: completedAt,
  });

  return evidence._id;
}

export function buildSanitizedQuizPayload(module, attemptDoc) {
  const session = attemptDoc.quizSession || {};
  const optionOrder = mapOptionOrderToObject(session.optionOrderByQuestion);
  const questions = (session.selectedQuestionIds || [])
    .map((id) => findQuestion(module, id))
    .filter(Boolean)
    .map((q) => sanitizeQuestion(q, optionOrder[q.id]));

  return {
    sessionId: String(attemptDoc._id),
    status: session.status,
    startedAt: session.startedAt,
    submittedAt: session.submittedAt,
    questions,
    meta: {
      passingScore: module.quiz?.passingScore ?? 0.8,
      questionsPerAttempt: questions.length,
      maxAttempts: module.quiz?.maxAttempts ?? 3,
      retryDelayHours: module.quiz?.retryDelayHours ?? 24,
    },
    attempt: serializeAttemptSummary(attemptDoc, module),
  };
}

function assertCanTakeQuiz(attempt, module) {
  if ((attempt.readProgressPercent || 0) < 100 && !attempt.readCompletedAt) {
    throw makeError('Read the training document before taking the quiz', 400);
  }
  if (attempt.passedAt) {
    throw makeError('You have already passed this training module', 400);
  }
  if (attempt.nextRetryAt && attempt.nextRetryAt > new Date()) {
    throw makeError(`Quiz retry available after ${attempt.nextRetryAt.toISOString()}`, 429);
  }
  if (attempt.attempts >= (module.quiz?.maxAttempts || 3)) {
    throw makeError('Maximum quiz attempts reached', 400);
  }
}

export async function startTrainingQuiz(module, attemptDoc, { forceNew = false } = {}) {
  assertCanTakeQuiz(attemptDoc, module);

  const session = attemptDoc.quizSession || {};
  const hasActiveSession =
    session.status === 'in_progress' &&
    Array.isArray(session.selectedQuestionIds) &&
    session.selectedQuestionIds.length > 0;

  if (hasActiveSession && !forceNew) {
    return buildSanitizedQuizPayload(module, attemptDoc);
  }

  if (session.status === 'submitted' && !forceNew) {
    throw makeError('Call quiz start with a new attempt after a failed submission', 400);
  }

  const count = getQuestionsPerAttempt(module);
  const allIds = (module.quiz?.questions || []).map((q) => q.id);
  const selectedQuestionIds = shuffleInPlace(allIds).slice(0, count);
  const selectedQuestions = selectedQuestionIds
    .map((id) => findQuestion(module, id))
    .filter(Boolean);
  const optionOrder = buildOptionOrderForQuestions(selectedQuestions);

  attemptDoc.quizSession = {
    status: 'in_progress',
    selectedQuestionIds,
    optionOrderByQuestion: optionOrder,
    startedAt: new Date(),
    submittedAt: null,
    answers: [],
    scorePercent: null,
    correctCount: null,
    totalQuestions: selectedQuestionIds.length,
  };
  await attemptDoc.save();

  return buildSanitizedQuizPayload(module, attemptDoc);
}

export async function submitTrainingQuiz(module, attemptDoc, answers, currentUser) {
  assertCanTakeQuiz(attemptDoc, module);

  const session = attemptDoc.quizSession || {};
  if (session.status !== 'in_progress' || !session.selectedQuestionIds?.length) {
    throw makeError('Start the quiz before submitting answers', 400);
  }

  const optionOrder = mapOptionOrderToObject(session.optionOrderByQuestion);
  const gradedAnswers = [];
  let correctCount = 0;

  for (const questionId of session.selectedQuestionIds) {
    const question = findQuestion(module, questionId);
    if (!question) continue;
    const selectedOptionId = answers?.[questionId];
    const isCorrect = selectedOptionId === question.correctOptionId;
    if (isCorrect) correctCount += 1;
    gradedAnswers.push({
      questionId,
      selectedOptionId: selectedOptionId || '',
      isCorrect,
    });
  }

  const totalQuestions = session.selectedQuestionIds.length;
  const score = totalQuestions ? correctCount / totalQuestions : 0;
  const passingScore = module.quiz?.passingScore ?? 0.8;
  const passed = score >= passingScore;

  attemptDoc.attempts = (attemptDoc.attempts || 0) + 1;
  attemptDoc.quizScore = score;
  attemptDoc.quizSession = {
    ...session,
    status: 'submitted',
    submittedAt: new Date(),
    answers: gradedAnswers,
    scorePercent: score,
    correctCount,
    totalQuestions,
  };

  if (passed) {
    attemptDoc.passedAt = new Date();
    attemptDoc.lastFailedAt = null;
    attemptDoc.nextRetryAt = null;
    attemptDoc.certificateEvidenceId = await generateTrainingCertificateEvidence({
      module,
      attempt: attemptDoc,
      currentUser,
      score,
    });
  } else if (attemptDoc.attempts < (module.quiz?.maxAttempts || 3)) {
    attemptDoc.lastFailedAt = new Date();
    attemptDoc.nextRetryAt = addHours(
      attemptDoc.lastFailedAt,
      module.quiz?.retryDelayHours ?? 24
    );
  }

  await attemptDoc.save();

  await logCrudOperation({
    organizationId: currentUser.organizationId,
    actorId: currentUser._id,
    action: passed ? 'STATUS_CHANGE' : 'UPDATE',
    entityType: 'TrainingAttempt',
    entityId: attemptDoc._id,
    entitySnapshot: { title: module.title, score, passed },
    after: attemptDoc.toObject(),
  });

  return getTrainingQuizResult(module, attemptDoc);
}

export function getTrainingQuizResult(module, attemptDoc) {
  const session = attemptDoc.quizSession || {};
  const optionOrder = mapOptionOrderToObject(session.optionOrderByQuestion);
  const review = (session.selectedQuestionIds || [])
    .map((id) => {
      const question = findQuestion(module, id);
      if (!question) return null;
      const answer = (session.answers || []).find((a) => a.questionId === id);
      return {
        ...sanitizeQuestion(question, optionOrder[id]),
        selectedOptionId: answer?.selectedOptionId || null,
        isCorrect: Boolean(answer?.isCorrect),
        explanation: question.explanation,
        correctOptionId: question.correctOptionId,
      };
    })
    .filter(Boolean);

  const passed = Boolean(attemptDoc.passedAt);
  const score = session.scorePercent ?? attemptDoc.quizScore ?? 0;

  return {
    passed,
    scorePercent: score,
    correctCount: session.correctCount ?? 0,
    totalQuestions: session.totalQuestions ?? review.length,
    passingScore: module.quiz?.passingScore ?? 0.8,
    canRetake:
      !passed &&
      (attemptDoc.attempts || 0) < (module.quiz?.maxAttempts || 3) &&
      (!attemptDoc.nextRetryAt || attemptDoc.nextRetryAt <= new Date()),
    nextRetryAt: attemptDoc.nextRetryAt || null,
    attempts: attemptDoc.attempts || 0,
    maxAttempts: module.quiz?.maxAttempts ?? 3,
    review,
    attempt: serializeAttemptSummary(attemptDoc, module),
  };
}

export async function prepareNewQuizRetake(attemptDoc) {
  attemptDoc.quizSession = {
    status: 'not_started',
    selectedQuestionIds: [],
    optionOrderByQuestion: {},
    startedAt: null,
    submittedAt: null,
    answers: [],
    scorePercent: null,
    correctCount: null,
    totalQuestions: null,
  };
  await attemptDoc.save();
  return attemptDoc;
}

export { getOrCreateTrainingAttempt, serializeAttemptSummary, getQuestionsPerAttempt };
