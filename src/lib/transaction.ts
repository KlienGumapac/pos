import mongoose, { Schema, Document } from 'mongoose';

interface IPhoneIdentifier {
  imei: string;
  serialNumber: string;
}

interface ITransactionItem {
  productId: mongoose.Types.ObjectId;
  productName: string;
  productSku: string;
  category: string;
  quantity: number;
  price: number;
  discount: number; // discount amount in currency
  total: number; // final amount after discount
  phoneIdentifiers?: IPhoneIdentifier[]; // IMEI/serial for items that have them
}

interface IReturnedItem {
  productId: mongoose.Types.ObjectId;
  productName: string;
  productSku: string;
  category: string;
  quantity: number;
  price: number;
  discount: number;
  total: number; // original item total
  returnAmount: number; // refunded amount
  description: string; // reason for return
  returnedAt: Date;
  phoneIdentifiers?: IPhoneIdentifier[]; // IMEI/serial for returned units
}

export interface ITransaction extends Document {
  cashierId: mongoose.Types.ObjectId;
  items: ITransactionItem[];
  returnedItems?: IReturnedItem[]; // items that have been returned
  subtotal: number;
  overallDiscount: number;
  totalAmount: number;
  cashReceived: number;
  change: number;
  status: 'completed' | 'refunded' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

const PhoneIdentifierSchema = new Schema({
  imei: { type: String, trim: true, default: '' },
  serialNumber: { type: String, trim: true, default: '' }
}, { _id: false });

const TransactionItemSchema = new Schema<ITransactionItem>({
  productId: { type: Schema.Types.ObjectId, required: true, ref: 'Product' },
  productName: { type: String, required: true },
  productSku: { type: String, required: true },
  category: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true, min: 0 },
  discount: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true, min: 0 },
  phoneIdentifiers: { type: [PhoneIdentifierSchema], default: [] },
});

const ReturnedItemSchema = new Schema<IReturnedItem>({
  productId: { type: Schema.Types.ObjectId, required: true, ref: 'Product' },
  productName: { type: String, required: true },
  productSku: { type: String, required: true },
  category: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true, min: 0 },
  discount: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true, min: 0 },
  returnAmount: { type: Number, required: true, min: 0 },
  description: { type: String, required: true },
  returnedAt: { type: Date, default: Date.now },
  phoneIdentifiers: { type: [PhoneIdentifierSchema], default: [] },
});

const TransactionSchema = new Schema<ITransaction>({
  cashierId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  items: [TransactionItemSchema],
  returnedItems: { type: [ReturnedItemSchema], default: [] },
  subtotal: { type: Number, required: true, min: 0 },
  overallDiscount: { type: Number, required: true, min: 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  cashReceived: { type: Number, required: true, min: 0 },
  change: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['completed', 'refunded', 'cancelled'], default: 'completed' },
}, {
  timestamps: true,
});

// Force model recreation to ensure schema changes are applied
if (mongoose.models.Transaction) {
  delete mongoose.models.Transaction;
}

export const Transaction = mongoose.model<ITransaction>('Transaction', TransactionSchema);
