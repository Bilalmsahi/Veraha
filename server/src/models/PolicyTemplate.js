import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * PolicyTemplate Model (Global Domain)
 *
 * Represents policy templates in the library (Vanta-style).
 * No organizationId - shared across all tenants.
 * Templates map 1:1 to files in Vanta-Policy-Templates/.
 */
const policyTemplateSchema = new Schema(
  {
    slug: {
      type: String,
      required: [true, 'Slug is required'],
      unique: true,
      trim: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Policy template title is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    filename: {
      type: String,
      required: [true, 'Filename is required'],
      trim: true,
    },
    /** Storage key for the template file (S3 or local). Set during seeding when file is uploaded. */
    fileKey: {
      type: String,
      trim: true,
      index: true,
    },
    frameworkCodes: [
      {
        type: String,
        uppercase: true,
        trim: true,
      },
    ],
    category: {
      type: String,
      trim: true,
    },
    source: {
      type: String,
      enum: ['VANTA', 'CUSTOM'],
      default: 'VANTA',
    },
  },
  {
    timestamps: true,
    collection: 'policytemplates',
  }
);

policyTemplateSchema.index({ frameworkCodes: 1 });
policyTemplateSchema.index({ title: 'text', description: 'text' });

const PolicyTemplate = mongoose.model('PolicyTemplate', policyTemplateSchema);

export default PolicyTemplate;
