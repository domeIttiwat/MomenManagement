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

  const { data, error } = await supabase
    .from('stock_lots')
    .insert([{
      lot_code: lotCode || buildLotCode(sourceType === 'purchase_order' ? 'PO' : 'LOT'),
      product_id: productId,
      variant_id: nullOrValue(variantId),
      location_id: nullOrValue(locationId),
      purchase_order_id: nullOrValue(purchaseOrderId),
      purchase_order_item_id: nullOrValue(purchaseOrderItemId),
      supplier_id: nullOrValue(supplierId),
      source_type: sourceType,
      original_quantity: qty,
      remaining_quantity: qty,
      landed_unit_cost_thb: round2(unitCostThb),
      received_at: receivedAt || new Date().toISOString(),
      note,
      created_by: nullOrValue(profileId),
    }])
    .select('*')
    .single();

  if (error) {
    if (isMissingSchemaError(error)) {
      if (syncSummary) {
        await syncStockItemQuantity({ productId, variantId, locationId, delta: qty, profileId });
      }
      return null;
    }
    throw error;
  }

  if (syncSummary) {
    await syncStockItemQuantity({ productId, variantId, locationId, delta: qty, profileId });
  }
  return data;
}

export async function allocateFifoStockOut({
  productId,
  variantId = null,
  locationId = null,
  quantity,
  referenceType = 'manual',
  referenceId = null,
  stockTransactionId = null,
  profileId = null,
  syncSummary = true,
}) {
  const requestedQty = Math.max(0, Math.trunc(toNum(quantity)));
  if (!productId || requestedQty <= 0) {
    return { allocations: [], totalCost: 0, weightedUnitCost: 0, missingQty: requestedQty };
  }

  let q = supabase
    .from('stock_lots')
    .select('id, remaining_quantity, landed_unit_cost_thb, location_id, received_at, created_at')
    .eq('product_id', productId)
    .gt('remaining_quantity', 0)
    .order('received_at', { ascending: true })
    .order('created_at', { ascending: true });
  if (variantId) q = q.eq('variant_id', variantId); else q = q.is('variant_id', null);
  if (locationId) q = q.eq('location_id', locationId);

  const { data: lots, error } = await q;
  if (error) {
    if (isMissingSchemaError(error)) {
      const prices = await getCurrentProductPrices(productId, variantId);
      if (syncSummary) {
        await syncStockItemQuantity({ productId, variantId, locationId, delta: -requestedQty, profileId });
      }
      return {
        allocations: [],
        totalCost: round2(prices.cost_price * requestedQty),
        weightedUnitCost: round2(prices.cost_price),
        missingQty: 0,
      };
    }
    throw error;
  }

  let remaining = requestedQty;
  const allocations = [];

  for (const lot of lots || []) {
    if (remaining <= 0) break;
    const available = Math.max(0, Math.trunc(toNum(lot.remaining_quantity)));
    if (available <= 0) continue;
    const qty = Math.min(available, remaining);
    const unitCost = round2(lot.landed_unit_cost_thb);

    const { error: updateError } = await supabase
      .from('stock_lots')
      .update({
        remaining_quantity: available - qty,
        updated_at: new Date().toISOString(),
      })
      .eq('id', lot.id);
    if (updateError) throw updateError;

    const allocationPayload = {
      stock_transaction_id: nullOrValue(stockTransactionId),
      stock_lot_id: lot.id,
      product_id: productId,
      variant_id: nullOrValue(variantId),
      quantity: qty,
      unit_cost_thb: unitCost,
      reference_type: referenceType,
      reference_id: nullOrValue(referenceId),
      created_by: nullOrValue(profileId),
    };
    const { data: allocation, error: allocationError } = await supabase
      .from('stock_lot_allocations')
      .insert([allocationPayload])
      .select('*')
      .single();
    if (allocationError) throw allocationError;

    allocations.push(allocation || allocationPayload);
    remaining -= qty;
  }

  const allocatedQty = requestedQty - remaining;
  if (syncSummary && allocatedQty > 0) {
    await syncStockItemQuantity({ productId, variantId, locationId, delta: -allocatedQty, profileId });
  }

  const fallbackCost = remaining > 0 ? toNum((await getCurrentProductPrices(productId, variantId)).cost_price) : 0;
  const allocatedCost = allocations.reduce((sum, a) => sum + (toNum(a.unit_cost_thb) * toNum(a.quantity)), 0);
  const totalCost = round2(allocatedCost + (remaining * fallbackCost));
  const weightedUnitCost = requestedQty > 0 ? round2(totalCost / requestedQty) : 0;

  return {
    allocations,
    totalCost,
    weightedUnitCost,
    missingQty: remaining,
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
