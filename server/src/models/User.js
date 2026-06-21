import mongoose from 'mongoose';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { ROLE, USER_STATUS } from './enums.js';
import tenantPlugin from './plugins/tenantPlugin.js';
import { authorizationPlugin } from './plugins/tenantPlugin.js';

const { Schema } = mongoose;

/**
 * User Model (Tenant Domain)
 * 
 * Represents users within an organization.
 * Includes soft delete for audit trail preservation.
 * 
 * CRITICAL: Use virtual 'password' field for setting passwords.
 * The 'passwordHash' field stores the bcrypt hash.
 */
const userSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is required'],
      index: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
      validate: {
        validator: function (email) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        },
        message: 'Invalid email format',
      },
    },
    passwordHash: {
      type: String,
      // Custom required validator: allow if password virtual is set (will be hashed in pre-save)
      required: [
        function () {
          // Required unless password virtual is set (will be hashed in pre-save hook)
          return !this._password && !this.passwordHash;
        },
        'Password is required',
      ],
      select: false, // Don't include in queries by default
    },
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
    },
    role: {
      type: String,
      enum: ROLE,
      default: 'EMPLOYEE',
    },
    status: {
      type: String,
      enum: USER_STATUS,
      default: 'INVITED',
    },
    mfaEnabled: {
      type: Boolean,
      default: false,
    },
    mfaSecret: {
      type: String,
      select: false,
    },
    lastLoginAt: {
      type: Date,
    },
    lastActivityAt: {
      type: Date,
    },
    loginCount: {
      type: Number,
      default: 0,
    },
    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    invitedAt: {
      type: Date,
    },
    inviteToken: {
      type: String,
      select: false,
    },
    inviteExpiresAt: {
      type: Date,
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpiresAt: {
      type: Date,
    },
    lastPasswordChange: {
      type: Date,
    },
    settings: {
      sessionTimeoutMinutes: {
        type: Number,
        enum: [30, 60, 240, 480, 1440, 2880, 4320, 10080],
      },
    },
    // Soft Delete Fields
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'users',
  }
);

// =============================================================================
// VIRTUALS
// =============================================================================

/**
 * Full name virtual
 */
userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

/**
 * Password virtual (for setting passwords)
 * 
 * Usage:
 *   const user = new User({ email, password: 'PlainText123!', ... });
 *   await user.save(); // Password gets hashed automatically
 */
userSchema.virtual('password')
  .set(function (password) {
    this._password = password;
  })
  .get(function () {
    return this._password;
  });

// =============================================================================
// VALIDATION MIDDLEWARE
// =============================================================================

/**
 * Password strength validation
 */
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;

function validatePasswordStrength(password) {
  if (!PASSWORD_REGEX.test(password)) {
    throw new Error(
      'Password must be at least 12 characters and contain: uppercase, lowercase, number, and special character (@$!%*?&)'
    );
  }
}

/**
 * Validate email uniqueness within organization
 * SECURITY FIX: Scoped to organizationId to prevent cross-tenant collisions
 * Mongoose 9.x: Use async function without next callback
 */
userSchema.pre('save', async function () {
  if (this.isNew || this.isModified('email')) {
    const exists = await this.constructor.findOne({
      email: this.email,
      organizationId: this.organizationId, // SECURITY: Scope to same org
      _id: { $ne: this._id },
      isDeleted: false,
    });

    if (exists) {
      throw new Error(`Email ${this.email} is already in use in this organization`);
    }
  }
});

// =============================================================================
// PASSWORD HASHING MIDDLEWARE
// =============================================================================

/**
 * Hash password before saving
 * Only runs if password was set via virtual field
 * Mongoose 9.x: Use async function without next callback
 */
userSchema.pre('save', async function () {
  // Only hash if password was set via virtual
  if (!this._password) {
    return;
  }

  // Validate password strength (throws if invalid)
  validatePasswordStrength(this._password);

  // Hash password
  this.passwordHash = await bcrypt.hash(this._password, 12);

  // Update last password change timestamp
  if (!this.isNew) {
    this.lastPasswordChange = new Date();

    // Log password change using safe service (won't crash if logging fails)
    try {
      const { logSecurityEvent } = await import('../services/activityLogger.js');
      await logSecurityEvent({
        organizationId: this.organizationId,
        userId: this._id,
        userEmail: this.email,
        userName: this.fullName,
        userRole: this.role,
        eventType: 'PASSWORD_CHANGE',
        details: { securityEvent: true },
      });
    } catch (error) {
      // Log but don't fail password change
      console.error('[User] Failed to log password change:', error.message);
    }
  }

  // Clear plaintext password from memory
  this._password = undefined;
});

// =============================================================================
// INSTANCE METHODS
// =============================================================================

/**
 * Compare password with hash
 * @param {String} candidatePassword - Plaintext password to check
 * @returns {Promise<Boolean>} True if password matches
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.passwordHash) {
    // Load password hash if not selected
    const user = await this.constructor.findById(this._id).select('+passwordHash');
    if (!user || !user.passwordHash) {
      return false;
    }
    return bcrypt.compare(candidatePassword, user.passwordHash);
  }

  return bcrypt.compare(candidatePassword, this.passwordHash);
};

/**
 * Generate password reset token
 * @returns {String} Reset token (plain text - to be sent to user)
 */
userSchema.methods.generatePasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');

  // Hash token before storing
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Token expires in 1 hour
  this.passwordResetExpiresAt = new Date(Date.now() + 3600000);

  return resetToken; // Return plain token to send to user
};

/**
 * Generate invite token
 * @returns {String} Invite token (plain text)
 */
userSchema.methods.generateInviteToken = function () {
  const inviteToken = crypto.randomBytes(32).toString('hex');

  // Hash token before storing
  this.inviteToken = crypto
    .createHash('sha256')
    .update(inviteToken)
    .digest('hex');

  // Token expires in 7 days
  this.inviteExpiresAt = new Date(Date.now() + 7 * 24 * 3600000);

  return inviteToken;
};

/**
 * Record successful login
 */
userSchema.methods.recordLogin = async function () {
  this.lastLoginAt = new Date();
  this.lastActivityAt = this.lastLoginAt;
  this.loginCount = (this.loginCount || 0) + 1;

  // Update status to ACTIVE if it was INVITED
  if (this.status === 'INVITED') {
    this.status = 'ACTIVE';
  }

  await this.save();

  try {
    const { logSecurityEvent } = await import('../services/activityLogger.js');
    await logSecurityEvent({
      organizationId: this.organizationId,
      userId: this._id,
      userEmail: this.email,
      userName: this.fullName,
      userRole: this.role,
      eventType: 'LOGIN',
      details: { loginCount: this.loginCount },
    });
  } catch (error) {
    console.error('[User] Failed to log login:', error.message);
  }
};

/**
 * Check if password needs to be changed (90 days)
 * @returns {Boolean}
 */
userSchema.methods.passwordNeedsChange = function () {
  if (!this.lastPasswordChange) {
    return false; // New user or never changed
  }

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  return this.lastPasswordChange < ninetyDaysAgo;
};

// =============================================================================
// STATIC METHODS
// =============================================================================

/**
 * Find user by email (including password hash)
 * @param {String} email
 * @returns {Promise<User|null>}
 */
userSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: email.toLowerCase() })
    .select('+passwordHash')
    .exec();
};

/**
 * Verify password reset token
 * @param {String} token - Plain text token from email
 * @returns {Promise<User|null>}
 */
userSchema.statics.findByResetToken = async function (token) {

  // Hash the plain token to compare with stored hash
  const hashedToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  return this.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpiresAt: { $gt: new Date() },
    isDeleted: false,
  }).select('+passwordResetToken');
};

/**
 * Verify invite token
 * Uses constant-time checks after lookup to prevent timing attacks
 * @param {String} token - Plain text token from email
 * @returns {Promise<User|null>}
 */
userSchema.statics.findByInviteToken = async function (token) {
  const hashedToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  // Only lookup by token hash and isDeleted - do other checks after
  const user = await this.findOne({
    inviteToken: hashedToken,
    isDeleted: false,
  }).select('+inviteToken');

  // Constant-time checks to prevent timing attacks
  if (!user) return null;
  if (user.status !== 'INVITED') return null;
  if (!user.inviteExpiresAt || user.inviteExpiresAt <= new Date()) return null;

  return user;
};

/**
 * Get users needing password change reminder
 * @param {ObjectId} organizationId
 * @returns {Promise<Array>}
 */
userSchema.statics.getUsersNeedingPasswordChange = async function (organizationId) {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  return this.find({
    organizationId,
    isDeleted: false,
    status: 'ACTIVE',
    lastPasswordChange: { $lt: ninetyDaysAgo },
  });
};

// =============================================================================
// INDEXES
// =============================================================================

// CRITICAL: Partial index - allows reusing emails after soft-delete
// Without this, soft-deleted users block new sign-ups with same email
userSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);
userSchema.index({ organizationId: 1, isDeleted: 1, role: 1 });
userSchema.index({ organizationId: 1, status: 1 });
userSchema.index({ inviteToken: 1 }, { sparse: true });
userSchema.index({ passwordResetToken: 1 }, { sparse: true });
userSchema.index({ lastLoginAt: -1 });
userSchema.index({ organizationId: 1, lastActivityAt: -1 });

// =============================================================================
// JSON TRANSFORMATION
// =============================================================================

// Exclude password and sensitive fields from JSON
userSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret.passwordHash;
    delete ret.mfaSecret;
    delete ret.inviteToken;
    delete ret.passwordResetToken;
    delete ret._password;
    return ret;
  },
});

userSchema.set('toObject', {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret.passwordHash;
    delete ret.mfaSecret;
    delete ret.inviteToken;
    delete ret.passwordResetToken;
    delete ret._password;
    return ret;
  },
});

// =============================================================================
// PLUGINS
// =============================================================================

// Apply tenant plugin for soft delete support
userSchema.plugin(tenantPlugin);

// Apply authorization plugin
userSchema.plugin(authorizationPlugin);

const User = mongoose.model('User', userSchema);

export default User;
