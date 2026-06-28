import { supabase } from '@/lib/supabase';

const toNum = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const round2 = (value) => Math.round((toNum(value) + Number.EPSILON) * 100) / 100;
const moneyOrNull = (value) => (value === null || value === undefined || value === '' ? null : round2(value));

const isMissingSchemaError = (error) => {
  const msg = String(error?.message || '').toLowerCase();
  return error?.code === '42P01' || msg.includes('does not exist') || msg.includes('schema cache');
};

const nullOrValue = (value) => value || null;

export const buildLotCode = (prefix = 'LOT') => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${date}-${suffix}`;
};

export async function getCurrentProductPrices(productId, variantId = null) {
  if (variantId) {
    const { data, error } = await supabase
      .from('product_variants')
      .select('cost_price, sell_price')
      .eq('id', variantId)
      .maybeSingle();
    if (error) throw error;
    return {
      cost_price: moneyOrNull(data?.cost_price),
      sell_price: toNum(data?.sell_price),
    };
  }

  const { data, error } = await supabase
    .from('products')
    .select('cost_price, sell_price')
    .eq('id', productId)
    .maybeSingle();
  if (error) throw error;
  return {
    cost_price: moneyOrNull(data?.cost_price),
    sell_price: toNum(data?.sell_price),
  };
}

export async function recordPriceHistory({
  productId,
  variantId = null,
  oldCostPrice = null,
  newCostPrice = null,
  oldSellPrice = null,
  newSellPrice = null,
  sourceType = 'manual',
  sourceId = null,
  note = null,
  profileId = null,
}) {
  const oldCost = moneyOrNull(oldCostPrice);
  const newCost = moneyOrNull(newCostPrice);
  const oldSell = moneyOrNull(oldSellPrice);
  const newSell = moneyOrNull(newSellPrice);
  const changed =
    oldCost !== newCost ||
    oldSell !== newSell;
  if (!changed || !productId) return null;

  const { data, error } = await supabase
    .from('product_price_history')
    .insert([{
      product_id: productId,
      variant_id: nullOrValue(variantId),
      old_cost_price: oldCost,
      new_cost_price: newCost,
      old_sell_price: oldSell,
      new_sell_price: newSell,
      source_type: sourceType,
      source_id: sourceId == null ? null : String(sourceId),
      note,
      changed_by: nullOrValue(profileId),
    }])
    .select('id')
    .single();

  if (error) {
    if (isMissingSchemaError(error)) return null;
    throw error;
  }
  return data;
}

export async function updateProductPrices({
  productId,
  variantId = null,
  newCostPrice,
  newSellPrice,
  sourceType = 'manual',
  sourceId = null,
  note = null,
  profileId = null,
}) {
  const current = await getCurrentProductPrices(productId, variantId);
  const payload = {};
  if (newCostPrice != null) payload.cost_price = round2(newCostPrice);
  if (newSellPrice != null) payload.sell_price = round2(newSellPrice);

  if (Object.keys(payload).length === 0) return current;

  const target = variantId
    ? supabase.from('product_variants').update(payload).eq('id', variantId)
    : supabase.from('products').update(payload).eq('id', productId);
  const { error } = await target;
  if (error) throw error;

  await recordPriceHistory({
    productId,
    variantId,
    oldCostPrice: current.cost_price,
    newCostPrice: newCostPrice == null ? current.cost_price : newCostPrice,
    oldSellPrice: current.sell_price,
    newSellPrice: newSellPrice == null ? current.sell_price : newSellPrice,
    sourceType,
    sourceId,
    note,
    profileId,
  });

  return {
    cost_price: newCostPrice == null ? current.cost_price : round2(newCostPrice),
    sell_price: newSellPrice == null ? current.sell_price : round2(newSellPrice),
  };
}

export async function syncStockItemQuantity({ productId, variantId = null, locationId = null, delta, profileId = null }) {
  let q = supabase.from('stock_items').select('id, quantity').eq('product_id', productId);
  if (variantId) q = q.eq('variant_id', variantId); else q = q.is('variant_id', null);
  if (locationId) q = q.eq('location_id', locationId); else q = q.is('location_id', null);
  const { data: existing, error } = await q.maybeSingle();
  if (error) throw error;

  if (existing) {
    const { error: updateError } = await supabase
      .from('stock_items')
      .update({
        quantity: Math.max(0, toNum(existing.quantity) + toNum(delta)),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
    if (updateError) throw updateError;
    return existing.id;
  }

  const { data, error: insertError } = await supabase
    .from('stock_items')
    .insert([{
      product_id: productId,
      variant_id: nullOrValue(variantId),
      location_id: nullOrValue(locationId),
      quantity: Math.max(0, toNum(delta)),
      created_by: nullOrValue(profileId),
    }])
    .select('id')
    .single();
  if (insertError) throw insertError;
  return data?.id || null;
}

export async function createStockLot({
  productId,
  variantId = null,
  locationId = null,
  quantity,
  unitCostThb,
  sourceType = 'manual',
  purchaseOrderId = null,
  purchaseOrderItemId = null,
  supplierId = null,
  lotCode = null,
  note = null,
  receivedAt = null,
  profileId = null,
  syncSummary = true,
}) {
  const qty = Math.max(0, Math.trunc(toNum(quantity)));
  if (!productId || qty <= 0) return null;

  // atomic (เฟส 1): insert lot + (option) อัปเดต summary ใน transaction เดียวฝั่ง DB ผ่าน RPC
  const { data, error } = await supabase.rpc('stock_add_lot', {
    p_product_id: productId,
    p_variant_id: nullOrValue(variantId),
    p_location_id: nullOrValue(locationId),
    p_quantity: qty,
    p_unit_cost: round2(unitCostThb),
    p_source_type: sourceType,
    p_purchase_order_id: nullOrValue(purchaseOrderId),
    p_purchase_order_item_id: nullOrValue(purchaseOrderItemId),
    p_supplier_id: nullOrValue(supplierId),
    p_lot_code: nullOrValue(lotCode),
    p_note: nullOrValue(note),
    p_received_at: nullOrValue(receivedAt),
    p_profile_id: nullOrValue(profileId),
    p_sync_summary: syncSummary,
  });
  if (error) throw error;
  return data; // { id, lot_code }
}

export async function allocateFifoStockOut(opts) {
  const {
    productId,
    variantId = null,
    quantity,
    referenceType = 'manual',
    referenceId = null,
    stockTransactionId = null,
    profileId = null,
    syncSummary = true,
  } = opts;
  // ผูกคลังหรือไม่: ถ้าผู้เรียก "ส่ง locationId มา" (แม้เป็น null = bin ไม่ระบุคลัง) = ตัดเฉพาะคลังนั้น
  // ถ้า "ไม่ส่ง locationId" (เช่น ขายออเดอร์/บริการ) = ตัดข้ามคลังแบบ FIFO ทั่วทั้งสินค้า
  const hasLocationConstraint = Object.prototype.hasOwnProperty.call(opts, 'locationId') && opts.locationId !== undefined;
  const constraintLocationId = hasLocationConstraint ? (opts.locationId || null) : null;
  const requestedQty = Math.max(0, Math.trunc(toNum(quantity)));
  if (!productId || requestedQty <= 0) {
    return { allocations: [], totalCost: 0, weightedUnitCost: 0, missingQty: requestedQty };
  }

  // atomic (เฟส 1): FIFO allocate + allocations + (option) ลด summary per-location ใน transaction เดียวฝั่ง DB
  const { data, error } = await supabase.rpc('stock_issue_fifo', {
    p_product_id: productId,
    p_variant_id: nullOrValue(variantId),
    p_quantity: requestedQty,
    p_location_scoped: hasLocationConstraint,
    p_location_id: constraintLocationId,
    p_reference_type: referenceType,
    p_reference_id: nullOrValue(referenceId),
    p_stock_transaction_id: nullOrValue(stockTransactionId),
    p_profile_id: nullOrValue(profileId),
    p_sync_summary: syncSummary,
  });
  if (error) throw error;
  return {
    allocations: Array.isArray(data?.allocations) ? data.allocations : [],
    totalCost: toNum(data?.totalCost),
    weightedUnitCost: toNum(data?.weightedUnitCost),
    missingQty: toNum(data?.missingQty),
  };
}

export async function receivePurchaseOrder({ purchaseOrderId, profileId = null, itemLocations = null }) {
  const [{ data: order, error: orderError }, { data: items, error: itemError }] = await Promise.all([
    supabase.from('purchase_orders').select('*').eq('id', purchaseOrderId).single(),
    supabase.from('purchase_order_items').select('*').eq('purchase_order_id', purchaseOrderId),
  ]);
  if (orderError) throw orderError;
  if (itemError) throw itemError;

  const rows = items || [];
  if (!rows.length) throw new Error('ไม่มีรายการสินค้าในรอบสั่งของนี้');

  const fxRate = toNum(order.fx_rate) || 1;
  const localFreightThb = order.currency === 'THB' ? 0 : toNum(order.freight_amount) * fxRate;
  const hasThaiFreightColumn = Object.prototype.hasOwnProperty.call(order, 'thai_freight_thb');
  const freightThb = hasThaiFreightColumn
    ? round2(localFreightThb + toNum(order.thai_freight_thb))
    : round2(toNum(order.freight_thb) || localFreightThb);

  const normalized = rows.map((item) => {
    const qty = Math.max(0, Math.trunc(toNum(item.quantity_received ?? item.quantity_ordered)));
    const unitCostForeign = toNum(item.unit_cost_foreign);
    const lineTotalForeign = round2(unitCostForeign * qty);
    const lineTotalThb = round2(lineTotalForeign * fxRate);
    return { ...item, qty, unitCostForeign, lineTotalForeign, lineTotalThb };
  });
  const subtotalForeign = round2(normalized.reduce((sum, item) => sum + item.lineTotalForeign, 0));
  const subtotalThb = round2(normalized.reduce((sum, item) => sum + item.lineTotalThb, 0));
  const grandTotalThb = round2(subtotalThb + freightThb);

  for (const item of normalized) {
    const freightShare = subtotalThb > 0 ? round2(freightThb * (item.lineTotalThb / subtotalThb)) : 0;
    const landedUnitCost = item.qty > 0 ? round2((item.lineTotalThb + freightShare) / item.qty) : 0;
    // ปลายทางคลัง: ใช้ค่าที่เลือกตอนรับเข้า (modal) ก่อน, ถ้าไม่ได้เลือกค่อย fallback เป็น location เดิมของรายการ
    const chosenLocationId = (itemLocations && Object.prototype.hasOwnProperty.call(itemLocations, item.id))
      ? (itemLocations[item.id] || null)
      : (item.location_id || null);

    const { error: updateItemError } = await supabase
      .from('purchase_order_items')
      .update({
        quantity_received: item.qty,
        line_total_foreign: item.lineTotalForeign,
        unit_cost_thb: item.qty > 0 ? round2(item.lineTotalThb / item.qty) : 0,
        line_total_thb: item.lineTotalThb,
        allocated_freight_thb: freightShare,
        landed_unit_cost_thb: landedUnitCost,
        location_id: chosenLocationId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', item.id);
    if (updateItemError) throw updateItemError;

    await createStockLot({
      productId: item.product_id,
      variantId: item.variant_id,
      locationId: chosenLocationId,
      quantity: item.qty,
      unitCostThb: landedUnitCost,
      sourceType: 'purchase_order',
      purchaseOrderId: purchaseOrderId,
      purchaseOrderItemId: item.id,
      supplierId: order.supplier_id,
      note: `รับเข้าจากรอบสั่งของ ${order.order_number}`,
      profileId,
      syncSummary: true,
    });

    await updateProductPrices({
      productId: item.product_id,
      variantId: item.variant_id,
      newCostPrice: landedUnitCost,
      newSellPrice: item.new_sell_price_thb == null ? null : item.new_sell_price_thb,
      sourceType: 'purchase_order',
      sourceId: purchaseOrderId,
      note: `รับเข้าจากรอบสั่งของ ${order.order_number}`,
      profileId,
    });
  }

  // เขียนเฉพาะคอลัมน์ที่มีจริงบนตาราง (กัน schema drift: บาง env ยังไม่มี thai_freight_thb)
  const orderUpdate = {
    status: 'received',
    received_at: order.received_at || new Date().toISOString(),
    subtotal_foreign: subtotalForeign,
    subtotal_thb: subtotalThb,
    freight_thb: freightThb,
    grand_total_thb: grandTotalThb,
    updated_by: nullOrValue(profileId),
    updated_at: new Date().toISOString(),
  };
  if (hasThaiFreightColumn) orderUpdate.thai_freight_thb = toNum(order.thai_freight_thb);

  const { error: updateOrderError } = await supabase
    .from('purchase_orders')
    .update(orderUpdate)
    .eq('id', purchaseOrderId);
  if (updateOrderError) throw updateOrderError;

  return {
    subtotalForeign,
    subtotalThb,
    freightThb,
    grandTotalThb,
    itemCount: normalized.length,
  };
}
