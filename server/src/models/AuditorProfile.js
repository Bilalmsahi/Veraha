import mongoose from 'mongoose';

const { Schema } = mongoose;

const auditorProfileSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    firstName: {
      type: String,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
    },
    firmName: {
      type: String,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
    collection: 'auditorprofiles',
  }
);

auditorProfileSchema.index({ email: 1 }, { unique: true, sparse: true });

auditorProfileSchema.statics.findOrCreate = async function (email, defaults = {}, options = {}) {
  const normalizedEmail = email.toLowerCase().trim();

  return this.findOneAndUpdate(
    { email: normalizedEmail },
    {
      $setOnInsert: {
        ...defaults,
        email: normalizedEmail,
        createdAt: defaults.createdAt || new Date(),
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
      ...options,
    }
  );
};

const AuditorProfile = mongoose.model('AuditorProfile', auditorProfileSchema);

export default AuditorProfile;
