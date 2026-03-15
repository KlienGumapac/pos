import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Distribution } from '@/lib/distribution';
import Product from '@/lib/product';

// Cashier-to-cashier distribution endpoint
export async function POST(request: NextRequest) {
  try {
    const dbConnection = await connectDB();
    
    if (!dbConnection) {
      return NextResponse.json(
        { success: false, error: 'Database connection not available' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { senderCashierId, receiverCashierId, items, notes } = body;
    
    console.log('Received cashier-to-cashier distribution request:', {
      senderCashierId,
      receiverCashierId,
      itemsCount: items?.length,
      items: items?.map((item: any) => ({
        name: item.productName,
        sku: item.productSku,
        quantity: item.quantity
      }))
    });
    
    // Validate required fields
    if (!senderCashierId || !receiverCashierId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (senderCashierId === receiverCashierId) {
      return NextResponse.json(
        { success: false, error: 'Cannot distribute to yourself' },
        { status: 400 }
      );
    }

    // Validate items
    for (const item of items) {
      if (!item.productId || !item.productName || !item.productSku || !item.category ||
          !item.quantity || !item.price) {
        return NextResponse.json(
          { success: false, error: 'Invalid item data - missing required fields' },
          { status: 400 }
        );
      }
    }

    // Check if sender cashier has sufficient stock in their distributions
    const senderDistributions = await Distribution.find({ 
      cashierId: senderCashierId,
      status: { $in: ['pending', 'delivered'] }
    });

    // Calculate available stock for each product
    const senderStock: Record<string, number> = {};
    
    senderDistributions.forEach(dist => {
      dist.items.forEach(item => {
        if (!senderStock[item.productId.toString()]) {
          senderStock[item.productId.toString()] = 0;
        }
        senderStock[item.productId.toString()] += item.quantity;
      });
    });

    // Check if sender has enough stock
    for (const item of items) {
      const availableStock = senderStock[item.productId] || 0;
      if (availableStock < item.quantity) {
        return NextResponse.json(
          { success: false, error: `Insufficient stock for ${item.productName}. Available: ${availableStock}, Requested: ${item.quantity}` },
          { status: 400 }
        );
      }
    }

    // Calculate total value
    const totalValue = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Reduce stock from sender's distributions (FIFO - First In First Out)
    const sortedDistributions = [...senderDistributions].sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    for (const item of items) {
      const itemPhones = Array.isArray(item.phoneIdentifiers) ? item.phoneIdentifiers : [];
      let remainingToDeduct = item.quantity;

      if (itemPhones.length > 0) {
        // Deduct by removing specific IMEI/serial from sender's distribution items
        for (const pi of itemPhones) {
          let removed = false;
          for (const dist of sortedDistributions) {
            if (removed) break;
            const distItem = dist.items.find((di: any) => di.productId.toString() === item.productId);
            if (!distItem || !Array.isArray(distItem.phoneIdentifiers)) continue;
            const idx = distItem.phoneIdentifiers.findIndex(
              (p: any) => (p.imei || '') === (pi.imei || '') && (p.serialNumber || '') === (pi.serialNumber || '')
            );
            if (idx === -1) continue;
            distItem.phoneIdentifiers.splice(idx, 1);
            distItem.quantity -= 1;
            remainingToDeduct -= 1;
            removed = true;
            if (distItem.quantity <= 0) {
              dist.items = dist.items.filter((di: any) => di.productId.toString() !== item.productId);
            } else {
              distItem.totalValue = distItem.price * distItem.quantity;
            }
            dist.totalValue = dist.items.reduce((sum: number, di: any) => sum + (di.price * di.quantity), 0);
            if (dist.items.length === 0) dist.status = 'cancelled';
            dist.markModified('items');
            await dist.save();
          }
        }
      }

      // Quantity-based deduction (for items without phoneIdentifiers or remaining qty)
      for (const dist of sortedDistributions) {
        if (remainingToDeduct <= 0) break;
        const distItem = dist.items.find((di: any) => di.productId.toString() === item.productId);
        if (distItem && distItem.quantity > 0) {
          const deduction = Math.min(remainingToDeduct, distItem.quantity);
          distItem.quantity -= deduction;
          remainingToDeduct -= deduction;
          if (distItem.quantity === 0) {
            dist.items = dist.items.filter((di: any) => di.productId.toString() !== item.productId);
          } else {
            distItem.totalValue = distItem.price * distItem.quantity;
          }
          dist.totalValue = dist.items.reduce((sum: number, di: any) => sum + (di.price * di.quantity), 0);
          if (dist.items.length === 0) dist.status = 'cancelled';
          dist.markModified('items');
          await dist.save();
        }
      }
    }

    // Check if receiver already has distributions and add to existing or create new
    const receiverDistributions = await Distribution.find({
      cashierId: receiverCashierId,
      status: { $in: ['pending', 'delivered'] }
    });

    const itemsToAdd = items.map((item: any) => ({
      productId: item.productId,
      productName: item.productName,
      productSku: item.productSku,
      category: item.category || "Accessories",
      quantity: item.quantity,
      price: item.price,
      totalValue: item.price * item.quantity,
      phoneIdentifiers: Array.isArray(item.phoneIdentifiers) ? item.phoneIdentifiers : []
    }));

    // Try to add to existing distributions
    let addedToExisting = false;
    for (const dist of receiverDistributions) {
      for (const itemToAdd of itemsToAdd) {
        const existingItem = dist.items.find((di: any) => 
          di.productId.toString() === itemToAdd.productId
        );

        if (existingItem) {
          existingItem.quantity += itemToAdd.quantity;
          existingItem.totalValue = existingItem.price * existingItem.quantity;
          existingItem.phoneIdentifiers = [...(existingItem.phoneIdentifiers || []), ...(itemToAdd.phoneIdentifiers || [])];
          addedToExisting = true;
        } else {
          dist.items.push(itemToAdd);
          addedToExisting = true;
        }
      }

      if (addedToExisting) {
        dist.totalValue = dist.items.reduce((sum: number, di: any) => sum + di.totalValue, 0);
        dist.markModified('items');
        await dist.save();
        break;
      }
    }

    // If not added to existing, create a new distribution
    if (!addedToExisting) {
      const newDistribution = new Distribution({
        adminId: senderCashierId, // Use sender as adminId for cashier-to-cashier
        cashierId: receiverCashierId,
        items: itemsToAdd,
        totalValue,
        notes: notes || `Distribution from cashier`,
        status: 'delivered' // Auto-deliver cashier-to-cashier distributions
      });

      await newDistribution.save();
    }

    return NextResponse.json({
      success: true,
      message: 'Stock distributed successfully'
    });

  } catch (error) {
    console.error('Cashier-to-cashier distribution error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to distribute stock' },
      { status: 500 }
    );
  }
}
