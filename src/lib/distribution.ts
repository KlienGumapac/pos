import mongoose, { Schema, Document } from 'mongoose';

export interface IDistributionItem {
  productId: string;
  productName: string;
  productSku: string;
  category: string;
  quantity: number;
  price: number;
  totalValue: number;
  phoneIdentifiers?: Array<{ imei: string; serialNumber: string }>;
}

export interface IDistribution extends Document {
  id: string;
  adminId: string;
  cashierId: string;
  items: IDistributionItem[];
  totalValue: number;
  status: 'pending' | 'delivered' | 'cancelled';
  notes?: string;
  /** When true, this record is only for sender's "Distributed" tab; do not count as receiver inventory */
  isSentOnly?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PhoneIdentifierSchema = new Schema({
  imei: { type: String, trim: true, default: '' },
  serialNumber: { type: String, trim: true, default: '' }
}, { _id: false });

const DistributionItemSchema = new Schema({
  productId: { type: String, required: true },
  productName: { type: String, required: true },
  productSku: { type: String, required: true },
  category: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true, min: 0 },
  totalValue: { type: Number, required: true, min: 0 },
  phoneIdentifiers: { type: [PhoneIdentifierSchema], default: [] }
}, { _id: false });

const DistributionSchema = new Schema({
  adminId: { type: String, required: true },
  cashierId: { type: String, required: true },
  items: [DistributionItemSchema],
  totalValue: { type: Number, required: true, min: 0 },
  status: { 
    type: String, 
    enum: ['pending', 'delivered', 'cancelled'], 
    default: 'pending' 
  },
  notes: { type: String },
  isSentOnly: { type: Boolean, default: false }
}, {
  timestamps: true
});

// Add virtual id field
DistributionSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

// Ensure virtual fields are serialized
DistributionSchema.set('toJSON', {
  virtuals: true
});

DistributionSchema.set('toObject', {
  virtuals: true
});

// Force model recreation to ensure schema changes are applied
if (mongoose.models.Distribution) {
  delete mongoose.models.Distribution;
}

export const Distribution = mongoose.model<IDistribution>('Distribution', DistributionSchema);
