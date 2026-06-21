import mongoose from 'mongoose';
import crypto from 'crypto';

const { Schema } = mongoose;

const OTP_PURPOSE = ['REGISTRATION', 'FORGOT_PASSWORD', 'LOGIN'];
const OTP_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 5;

const otpSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    otpHash: {
      type: String,
      required: true,
    },
    purpose: {
      type: String,
      enum: OTP_PURPOSE,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
    attempts: {
      type: Number,
      default: 0,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    verifiedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

otpSchema.index({ email: 1, purpose: 1 });

/**
 * Generate a 6-digit OTP and store its hash.
 * Returns the plain-text OTP to be sent via email.
 */
otpSchema.statics.createOTP = async function (email, purpose) {
  await this.deleteMany({ email: email.toLowerCase(), purpose });

  const isDev = process.env.EMAIL_MODE === 'dev';
  const otp = isDev ? '888888' : String(Math.floor(100000 + Math.random() * 900000));
  const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

  await this.create({
    email: email.toLowerCase(),
    otpHash,
    purpose,
    expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
  });

  return otp;
};

/**
 * Verify an OTP. Returns true if valid, throws on failure.
 */
otpSchema.statics.verifyOTP = async function (email, otp, purpose) {
  const record = await this.findOne({
    email: email.toLowerCase(),
    purpose,
    verified: false,
    expiresAt: { $gt: new Date() },
  });

  if (!record) {
    const err = new Error('OTP has expired or does not exist. Please request a new one.');
    err.statusCode = 400;
    throw err;
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    await record.deleteOne();
    const err = new Error('Too many failed attempts. Please request a new code.');
    err.statusCode = 429;
    throw err;
  }

  const hash = crypto.createHash('sha256').update(otp).digest('hex');

  if (hash !== record.otpHash) {
    record.attempts += 1;
    await record.save();
    const remaining = MAX_ATTEMPTS - record.attempts;
    const err = new Error(`Invalid code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`);
    err.statusCode = 400;
    throw err;
  }

  record.verified = true;
  record.verifiedAt = new Date();
  await record.save();

  return true;
};

/**
 * Check if a verified OTP exists (for multi-step flows like forgot-password).
 */
otpSchema.statics.hasVerifiedOTP = async function (email, purpose) {
  const record = await this.findOne({
    email: email.toLowerCase(),
    purpose,
    verified: true,
    expiresAt: { $gt: new Date() },
  });
  return !!record;
};

/**
 * Clean up verified OTP after use.
 */
otpSchema.statics.consumeVerifiedOTP = async function (email, purpose) {
  await this.deleteMany({ email: email.toLowerCase(), purpose });
};

/**
 * Rate limit: check if an OTP was sent recently (within cooldown seconds).
 */
otpSchema.statics.canResend = async function (email, purpose, cooldownSeconds = 60) {
  const recent = await this.findOne({
    email: email.toLowerCase(),
    purpose,
    createdAt: { $gt: new Date(Date.now() - cooldownSeconds * 1000) },
  });
  return !recent;
};

const OTP = mongoose.model('OTP', otpSchema);

export default OTP;
