import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Product from '@/lib/product';

// POST - Adjust stock for a product
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();

    const { id } = await params;
    const { adjustment, reason, phoneIdentifiersToAdd } = await request.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Product ID is required' },
        { status: 400 }
      );
    }

    if (typeof adjustment !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Adjustment must be a number' },
        { status: 400 }
      );
    }

    // Find the product
    const product = await Product.findById(id);

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }

    const existingIdentifiers = Array.isArray((product as any).phoneIdentifiers) ? (product as any).phoneIdentifiers : [];
    const isTrackedByIdentifiers = existingIdentifiers.length > 0 || (Array.isArray(phoneIdentifiersToAdd) && phoneIdentifiersToAdd.length > 0);

    // If this product is tracked by IMEI/Serial, require identifiers when adding stock
    if (isTrackedByIdentifiers && adjustment > 0) {
      const toAdd = Array.isArray(phoneIdentifiersToAdd) ? phoneIdentifiersToAdd : [];
      const validToAdd = toAdd
        .map((x: any) => ({
          imei: typeof x?.imei === 'string' ? x.imei.trim() : '',
          serialNumber: typeof x?.serialNumber === 'string' ? x.serialNumber.trim() : ''
        }))
        .filter((x: any) => x.imei || x.serialNumber);

      if (validToAdd.length === 0) {
        return NextResponse.json(
          { success: false, error: 'This product uses IMEI/Serial tracking. Please add IMEI/Serial entries when increasing stock.' },
          { status: 400 }
        );
      }

      // Prevent duplicates (against existing + within new list)
      const key = (x: any) => `${x.imei}||${x.serialNumber}`.toLowerCase();
      const existingKeys = new Set(existingIdentifiers.map((x: any) => key({ imei: x.imei || '', serialNumber: x.serialNumber || '' })));
      const newKeys = new Set<string>();
      for (const x of validToAdd) {
        const k = key(x);
        if (existingKeys.has(k) || newKeys.has(k)) {
          return NextResponse.json(
            { success: false, error: `Duplicate IMEI/Serial detected: IMEI "${x.imei || '—'}" Serial "${x.serialNumber || '—'}"` },
            { status: 400 }
          );
        }
        newKeys.add(k);
      }

      // Make stock adjustment match count of identifiers added
      const adjustmentFromIdentifiers = validToAdd.length;

      (product as any).phoneIdentifiers = [...existingIdentifiers, ...validToAdd];
      (product as any).stock = (product as any).phoneIdentifiers.length;
      await product.save();

      const formattedProduct = {
        id: (product as any)._id.toString(),
        name: (product as any).name,
        description: (product as any).description,
        sku: (product as any).sku,
        barcode: (product as any).barcode,
        price: (product as any).price,
        cost: (product as any).cost,
        category: (product as any).category,
        stock: (product as any).stock,
        minStock: (product as any).minStock,
        isActive: (product as any).isActive,
        images: (product as any).images,
        phoneIdentifiers: (product as any).phoneIdentifiers || [],
        createdAt: (product as any).createdAt,
        updatedAt: (product as any).updatedAt
      };

      return NextResponse.json({
        success: true,
        message: `Stock added successfully`,
        product: formattedProduct,
        adjustment: adjustmentFromIdentifiers,
        newStock: (product as any).stock,
        reason: reason || 'Manual adjustment'
      });
    }

    // Calculate new stock
    const newStock = product.stock + adjustment;

    // Prevent negative stock
    if (newStock < 0) {
      return NextResponse.json(
        { success: false, error: 'Stock cannot be negative' },
        { status: 400 }
      );
    }

    // Update the product stock
    product.stock = newStock;
    await product.save();

    // Return updated product
    const formattedProduct = {
      id: (product as any)._id.toString(),
      name: (product as any).name,
      description: (product as any).description,
      sku: (product as any).sku,
      barcode: (product as any).barcode,
      price: (product as any).price,
      cost: (product as any).cost,
      category: (product as any).category,
      stock: (product as any).stock,
      minStock: (product as any).minStock,
      isActive: (product as any).isActive,
      images: (product as any).images,
      phoneIdentifiers: (product as any).phoneIdentifiers || [],
      createdAt: (product as any).createdAt,
      updatedAt: (product as any).updatedAt
    };

    return NextResponse.json({
      success: true,
      message: `Stock ${adjustment >= 0 ? 'added' : 'reduced'} successfully`,
      product: formattedProduct,
      adjustment,
      newStock,
      reason: reason || 'Manual adjustment'
    });

  } catch (error) {
    console.error('Adjust stock error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
