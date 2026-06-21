import mongoose from 'mongoose';
const { Schema } = mongoose;

const riskAssessmentSchema = new Schema({
  riskId:       { type: Schema.Types.ObjectId, ref: 'Risk', required: true, index: true },
  assessedById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  assessedAt:   { type: Date, default: Date.now },
  notes:        { type: String, trim: true },

  snapshot: {
    inherentLikelihood: { type: Number, required: true },
    inherentImpact:     { type: Number, required: true },
    inherentScore:      { type: Number, required: true },
    inherentBand:       { type: String, required: true },
    residualLikelihood: { type: Number, required: true },
    residualImpact:     { type: Number, required: true },
    residualScore:      { type: Number, required: true },
    residualBand:       { type: String, required: true },
    treatmentType:      { type: String, required: true },
    mappedControlIds:   [{ type: Schema.Types.ObjectId, ref: 'InternalControl' }],
  },
}, {
  timestamps: false,
  collection: 'riskassessments',
});

// Immutability guard — assessments are append-only
riskAssessmentSchema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], function () {
  throw new Error('RiskAssessment documents are immutable. Create a new assessment instead.');
});

riskAssessmentSchema.index({ riskId: 1, assessedAt: -1 });

const RiskAssessment = mongoose.model('RiskAssessment', riskAssessmentSchema);
export default RiskAssessment;
