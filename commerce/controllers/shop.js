import mongoose from "mongoose";

import Affiliations from "../../models/Affiliations.js";
import Clubs from "../../models/Clubs.js";
import {
  canAccessTenantClub,
  denyTenantAccess,
  getPrimaryTenantClubId,
  isTenantSuperAdmin,
  normalizeTenantId,
  resolveTenantClubId,
} from "../../middleware/tenantIsolation.js";
import { normalizeText } from "../../utils/auth.js";
import CommerceRfidAssignments from "../models/CommerceRfidAssignments.js";
import CommerceShopAuditLogs from "../models/CommerceShopAuditLogs.js";
import CommerceShopOrders from "../models/CommerceShopOrders.js";
import CommerceShopProducts, {
  SHOP_PRODUCT_CATEGORIES,
} from "../models/CommerceShopProducts.js";
import CommerceWallets from "../models/CommerceWallets.js";

const MERCHANDISE_ONLY_ROLE_LABELS = new Set([
  "assistant admin",
  "club staff",
  "data encoder",
  "operator",
  "operators coordinator",
  "operators director",
  "operators secretary",
  "race director",
  "staff",
]);

const SHOP_MANAGER_ROLE_LABELS = new Set([
  "club owner",
  "club secretary",
  "inventory officer",
  "marketplace admin",
  "order fulfillment officer",
  "owner",
  "secretary",
  "shop manager",
]);

const PRODUCT_CATEGORY_LABELS = {
  merchandise: "Merchandise",
  race_essentials: "Race Essentials",
  supplies: "Supplies",
};

const PRODUCT_TYPE_LABELS = {
  breeding_boxes: "Breeding Boxes",
  caps: "Caps",
  club_tshirts: "Club T-Shirts",
  feeds: "Feeds",
  jackets: "Jackets",
  loft_supplies: "Loft Supplies",
  mugs: "Mugs",
  other: "Other",
  prepaid_race_stickers: "Pre-paid Race Stickers",
  race_slots: "Race Slots",
  rfid_rings: "RFID Rings",
  stickers: "Stickers",
  vitamins: "Vitamins",
};

const STATUS_LABELS = {
  archived: "Archived",
  in_stock: "In Stock",
  low_stock: "Low Stock",
  out_of_stock: "Out of Stock",
  preorder: "Preorder",
};

const ORDER_STATUS_LABELS = {
  cancelled: "Cancelled",
  delivered: "Delivered",
  paid: "Paid",
  pending: "Pending",
  ready_for_pickup: "Ready for Pickup",
  refunded: "Refunded",
};

const PAYMENT_METHOD_LABELS = {
  cash_on_pickup: "Cash on Pickup",
  club_credit: "Club Credit",
  gcash: "GCash",
  maya: "Maya",
};

const PAYMENT_STATUS_LABELS = {
  failed: "Failed",
  paid: "Paid",
  pending: "Pending",
  refunded: "Refunded",
};

const sendError = (res, error, status = 400) =>
  res.status(error?.status || status).json({ error: error.message || error });

const normalizeFlag = (value = "") =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

const getClientIp = (req) =>
  normalizeText(req.headers["x-forwarded-for"]).split(",")[0]?.trim() ||
  normalizeText(req.ip) ||
  normalizeText(req.socket?.remoteAddress);

const buildReference = (prefix) =>
  `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 7)
    .toUpperCase()}`;

const ensureObjectId = (value, label) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw Object.assign(new Error(`${label} is invalid.`), { status: 400 });
  }
};

const getRoleLabels = (auth = {}) =>
  [
    auth?.user?.role,
    ...(Array.isArray(auth.roleLabels) ? auth.roleLabels : []),
  ]
    .map(normalizeFlag)
    .filter(Boolean);

const isMerchandiseOnlyShopper = (auth = {}) => {
  if (!auth?.userId && !auth?.user?._id) {
    return true;
  }

  const labels = getRoleLabels(auth);
  const roleBuckets = Array.isArray(auth.roleBuckets) ? auth.roleBuckets : [];

  return (
    roleBuckets.includes("guest") ||
    roleBuckets.includes("operator") ||
    labels.some((label) => MERCHANDISE_ONLY_ROLE_LABELS.has(label))
  );
};

const hasShopManagementRole = (auth = {}) => {
  const labels = getRoleLabels(auth);
  const roleBuckets = Array.isArray(auth.roleBuckets) ? auth.roleBuckets : [];

  return (
    roleBuckets.some((bucket) => ["owner", "platform_admin", "secretary"].includes(bucket)) ||
    labels.some((label) => SHOP_MANAGER_ROLE_LABELS.has(label))
  );
};

const canManageShop = (auth = {}, clubId = "") =>
  isTenantSuperAdmin(auth) ||
  (canAccessTenantClub(auth, clubId) && hasShopManagementRole(auth));

const isPublicShopCatalogRequest = (req) =>
  ["directory", "guest", "public"].includes(
    normalizeFlag(req.query?.directory || req.query?.scope),
  );

const getAllowedProductCategories = (auth = {}, clubId = "", { forceMerchandiseOnly = false } = {}) => {
  if (forceMerchandiseOnly) {
    return ["merchandise"];
  }

  if (canManageShop(auth, clubId) || !isMerchandiseOnlyShopper(auth)) {
    return SHOP_PRODUCT_CATEGORIES;
  }

  return ["merchandise"];
};

const assertProductCategoryAccess = async (
  req,
  res,
  { category, clubId, forceMerchandiseOnly = false },
) => {
  if (
    getAllowedProductCategories(req.auth, clubId, { forceMerchandiseOnly }).includes(
      category,
    )
  ) {
    return true;
  }

  await denyTenantAccess(req, res, {
    attemptedClubId: clubId,
    message: "This product category is restricted to verified fanciers.",
    reason: `Restricted shop category requested: ${category}.`,
  });
  return false;
};

const logShopAudit = async (
  req,
  { action, clubId, metadata = {}, target = "" } = {},
) => {
  try {
    await CommerceShopAuditLogs.create({
      action,
      club: clubId,
      device: normalizeText(req.headers["user-agent"]).slice(0, 240),
      ip: getClientIp(req),
      metadata,
      role: getRoleLabels(req.auth).join(", "),
      target,
      user: mongoose.Types.ObjectId.isValid(req.auth?.userId) ? req.auth.userId : undefined,
    });
  } catch {
    // Audit logging should never make the primary shop action fail.
  }
};

const serializeProduct = (product = {}) => {
  const image =
    product.images?.[0]?.url ||
    "https://images.unsplash.com/photo-1543286386-713bdd548da4?w=600";
  const stockQuantity = Number(product.stockQuantity || 0);

  return {
    _id: String(product._id || ""),
    category: product.category,
    categoryLabel: PRODUCT_CATEGORY_LABELS[product.category] || "Merchandise",
    club: product.club,
    createdAt: product.createdAt,
    description: product.description || "",
    id: String(product._id || ""),
    image,
    images: product.images || [],
    isRaceEssential: product.category === "race_essentials",
    name: product.name || "Club shop product",
    pickupLocation: product.pickupLocation || "",
    price: Number(product.price?.amount || 0),
    priceInfo: product.price,
    productType: product.productType || "other",
    productTypeLabel: PRODUCT_TYPE_LABELS[product.productType] || "Other",
    revenue: Number(product.revenue || 0),
    salesCount: Number(product.salesCount || 0),
    sku: product.sku || "",
    status: STATUS_LABELS[product.status] || "In Stock",
    statusKey: product.status,
    stockQuantity,
    stockRemaining: stockQuantity,
    tags: product.tags || [],
    updatedAt: product.updatedAt,
  };
};

const serializeOrder = (order = {}) => ({
  _id: String(order._id || ""),
  affiliation: order.affiliation,
  buyer: order.buyer,
  club: order.club,
  createdAt: order.createdAt,
  currency: order.currency || "PHP",
  fulfillment: order.fulfillment || {},
  id: String(order._id || ""),
  items: (order.items || []).map((item) => ({
    _id: String(item._id || ""),
    category: item.category,
    product: item.product,
    productName: item.productName,
    productType: item.productType,
    quantity: Number(item.quantity || 0),
    rfidSerials: item.rfidSerials || [],
    sku: item.sku || "",
    total: Number(item.total || 0),
    unitPrice: Number(item.unitPrice || 0),
  })),
  orderNumber: order.orderNumber,
  orderStatus: ORDER_STATUS_LABELS[order.orderStatus] || "Pending",
  orderStatusKey: order.orderStatus,
  paymentMethod: PAYMENT_METHOD_LABELS[order.paymentMethod] || "GCash",
  paymentMethodKey: order.paymentMethod,
  paymentReference: order.paymentReference || "",
  paymentStatus: PAYMENT_STATUS_LABELS[order.paymentStatus] || "Pending",
  paymentStatusKey: order.paymentStatus,
  qrInvoice: {
    issuedAt: order.qr?.issuedAt,
    payload: JSON.stringify({
      clubId: normalizeTenantId(order.club),
      orderId: String(order._id || ""),
      orderNumber: order.orderNumber,
      token: order.qr?.token,
    }),
    token: order.qr?.token || "",
  },
  raceEssentials: order.raceEssentials || {},
  subtotal: Number(order.subtotal || 0),
  totalAmount: Number(order.totalAmount || 0),
  updatedAt: order.updatedAt,
});

const populateOrder = (query) =>
  query
    .populate("club", "name code abbr level location")
    .populate("buyer", "fullName email mobile pid")
    .populate("affiliation", "memberCode status membershipType roles user club");

const getRequestedShopClubId = (req) =>
  req.query?.clubId || req.query?.club || req.body?.clubId || req.body?.club;

const getShopClubId = (req, res, { allowPublicDirectoryClub = false, requireClub = true } = {}) => {
  const requestedClubId = getRequestedShopClubId(req);
  const normalizedRequestedClubId = normalizeTenantId(requestedClubId);

  if (allowPublicDirectoryClub && normalizedRequestedClubId) {
    return normalizedRequestedClubId;
  }

  return resolveTenantClubId(req, res, {
    requestedClubId,
    requireClub,
  });
};

const getProductFilter = (req, clubId, { forceMerchandiseOnly = false } = {}) => {
  const filter = {
    club: clubId,
    deletedAt: { $exists: false },
  };

  if (!canManageShop(req.auth, clubId)) {
    filter.status = { $ne: "archived" };
  }

  const allowedCategories = getAllowedProductCategories(req.auth, clubId, {
    forceMerchandiseOnly,
  });
  filter.category = { $in: allowedCategories };

  if (req.query?.category && allowedCategories.includes(String(req.query.category))) {
    filter.category = req.query.category;
  }

  if (req.query?.status) {
    filter.status = req.query.status;
  }

  if (req.query?.search) {
    const search = normalizeText(req.query.search);
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { sku: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
      { tags: { $regex: search, $options: "i" } },
    ];
  }

  return filter;
};

export const findShopProducts = async (req, res) => {
  try {
    const clubId = await getShopClubId(req, res, {
      allowPublicDirectoryClub: isPublicShopCatalogRequest(req),
    });

    if (clubId === null) return null;

    const forceMerchandiseOnly =
      isPublicShopCatalogRequest(req) &&
      !isTenantSuperAdmin(req.auth) &&
      !canAccessTenantClub(req.auth, clubId);

    if (
      req.query?.category &&
      SHOP_PRODUCT_CATEGORIES.includes(String(req.query.category)) &&
      !(await assertProductCategoryAccess(req, res, {
        category: String(req.query.category),
        clubId,
        forceMerchandiseOnly,
      }))
    ) {
      return null;
    }

    const payload = await CommerceShopProducts.find(
      getProductFilter(req, clubId, { forceMerchandiseOnly }),
    )
      .populate("club", "name code abbr level location logo")
      .populate("owner", "fullName email mobile")
      .sort({ createdAt: -1 })
      .lean({ virtuals: true });

    return res.json({
      payload: payload.map(serializeProduct),
      success: "Club shop products fetched successfully",
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const createShopProduct = async (req, res) => {
  try {
    const clubId = await getShopClubId(req, res);

    if (clubId === null) return null;

    if (!canManageShop(req.auth, clubId)) {
      return denyTenantAccess(req, res, {
        attemptedClubId: clubId,
        reason: "Shop product creation attempted without club store permissions.",
      });
    }

    const amount = Number(req.body?.price?.amount ?? req.body?.price ?? 0);

    if (!Number.isFinite(amount) || amount < 0) {
      return res.status(400).json({ error: "Product price is invalid." });
    }

    const created = await CommerceShopProducts.create({
      category: req.body?.category || "merchandise",
      club: clubId,
      description: normalizeText(req.body?.description),
      images: Array.isArray(req.body?.images)
        ? req.body.images
        : normalizeText(req.body?.image)
          ? [{ url: normalizeText(req.body.image), alt: normalizeText(req.body?.name) }]
          : [],
      lowStockThreshold: Number(req.body?.lowStockThreshold || 10),
      name: normalizeText(req.body?.name),
      owner: req.auth?.userId,
      pickupLocation: normalizeText(req.body?.pickupLocation),
      price: {
        amount,
        currency: normalizeText(req.body?.price?.currency || req.body?.currency || "PHP"),
      },
      productType: req.body?.productType || "other",
      rfid: {
        autoAssign:
          req.body?.productType === "rfid_rings" ||
          Boolean(req.body?.rfid?.autoAssign),
        prefix: normalizeText(req.body?.rfid?.prefix || "AGT-RFID"),
        nextSerial: Number(req.body?.rfid?.nextSerial || 1),
      },
      sku: normalizeText(req.body?.sku || buildReference("SKU")),
      stockQuantity: Number(req.body?.stockQuantity || 0),
      tags: Array.isArray(req.body?.tags)
        ? req.body.tags.map(normalizeText).filter(Boolean)
        : [],
    });

    await logShopAudit(req, {
      action: "product_creation",
      clubId,
      metadata: { category: created.category, productType: created.productType },
      target: created.name,
    });

    return res.status(201).json({
      payload: serializeProduct(created.toObject()),
      success: "Club shop product created successfully",
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const updateShopProduct = async (req, res) => {
  try {
    ensureObjectId(req.params.productId, "Product");
    const product = await CommerceShopProducts.findById(req.params.productId);

    if (!product || product.deletedAt) {
      return res.status(404).json({ error: "Shop product not found." });
    }

    const clubId = normalizeTenantId(product.club);

    if (!canManageShop(req.auth, clubId)) {
      return denyTenantAccess(req, res, {
        attemptedClubId: clubId,
        reason: "Shop product update attempted without club store permissions.",
      });
    }

    const nextPayload = { ...req.body };
    delete nextPayload.club;
    delete nextPayload.clubId;
    delete nextPayload.owner;

    if (nextPayload.price !== undefined) {
      const amount = Number(nextPayload.price?.amount ?? nextPayload.price);
      nextPayload.price = {
        amount,
        currency: normalizeText(nextPayload.price?.currency || req.body?.currency || "PHP"),
      };
    }

    if (nextPayload.image && !nextPayload.images) {
      nextPayload.images = [{ url: normalizeText(nextPayload.image), alt: product.name }];
    }

    product.set(nextPayload);
    await product.save();

    await logShopAudit(req, {
      action: "product_update",
      clubId,
      metadata: { productId: String(product._id) },
      target: product.name,
    });

    return res.json({
      payload: serializeProduct(product.toObject()),
      success: "Club shop product updated successfully",
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const archiveShopProduct = async (req, res) => {
  try {
    ensureObjectId(req.params.productId, "Product");
    const product = await CommerceShopProducts.findById(req.params.productId);

    if (!product || product.deletedAt) {
      return res.status(404).json({ error: "Shop product not found." });
    }

    const clubId = normalizeTenantId(product.club);

    if (!canManageShop(req.auth, clubId)) {
      return denyTenantAccess(req, res, {
        attemptedClubId: clubId,
        reason: "Shop product archive attempted without club store permissions.",
      });
    }

    product.status = "archived";
    product.archivedAt = new Date();
    product.deletedAt = new Date().toISOString();
    await product.save();

    await logShopAudit(req, {
      action: "product_deletion",
      clubId,
      metadata: { productId: String(product._id) },
      target: product.name,
    });

    return res.json({
      payload: serializeProduct(product.toObject()),
      success: "Club shop product archived successfully",
    });
  } catch (error) {
    return sendError(res, error);
  }
};

const loadApprovedAffiliation = async ({ clubId, userId }) =>
  Affiliations.findOne({
    club: clubId,
    deletedAt: { $exists: false },
    status: "approved",
    user: userId,
  }).lean();

const applyClubCreditPayment = async ({ amount, clubId, orderNumber, req }) => {
  const wallet = await CommerceWallets.findOne({
    club: clubId,
    deletedAt: { $exists: false },
    status: "active",
    user: req.auth.userId,
  });

  if (!wallet) {
    throw Object.assign(new Error("No active club credit wallet was found."), { status: 400 });
  }

  wallet.applyTransaction({
    amount,
    club: clubId,
    description: `Club shop purchase ${orderNumber}.`,
    direction: "debit",
    initiatedBy: req.auth.userId,
    referenceNumber: buildReference("SHOP"),
    status: "completed",
    type: "shop_purchase",
  });
  await wallet.save();
};

const incrementPaidSales = async (order) => {
  await Promise.all(
    (order.items || []).map((item) =>
      CommerceShopProducts.updateOne(
        { _id: item.product },
        {
          $inc: {
            revenue: Number(item.total || 0),
            salesCount: Number(item.quantity || 0),
          },
        },
      ),
    ),
  );
};

export const checkoutShopOrder = async (req, res) => {
  try {
    const requestedClubId =
      normalizeTenantId(req.body?.clubId || req.body?.club) || getPrimaryTenantClubId(req.auth);
    const clubId = await resolveTenantClubId(req, res, {
      requestedClubId,
      requireClub: true,
    });

    if (clubId === null) return null;

    const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];

    if (!rawItems.length) {
      return res.status(400).json({ error: "Checkout requires at least one product." });
    }

    const productIds = rawItems.map((item) => normalizeTenantId(item.productId || item.product));
    const products = await CommerceShopProducts.find({
      _id: { $in: productIds },
      club: clubId,
      deletedAt: { $exists: false },
      status: { $ne: "archived" },
    });
    const productMap = new Map(products.map((product) => [String(product._id), product]));

    if (products.length !== productIds.length) {
      return res.status(404).json({ error: "One or more shop products were not found." });
    }

    const orderItems = [];
    let hasRaceEssentials = false;

    for (const rawItem of rawItems) {
      const productId = normalizeTenantId(rawItem.productId || rawItem.product);
      const product = productMap.get(productId);
      const quantity = Math.max(1, Number(rawItem.quantity || 1));

      if (!(await assertProductCategoryAccess(req, res, { category: product.category, clubId }))) {
        return null;
      }

      if (product.category === "race_essentials") {
        hasRaceEssentials = true;
      }

      if (product.status !== "preorder" && Number(product.stockQuantity || 0) < quantity) {
        return res.status(409).json({
          error: `${product.name} does not have enough stock for this order.`,
        });
      }

      const unitPrice = Number(product.price?.amount || 0);
      orderItems.push({
        category: product.category,
        product: product._id,
        productName: product.name,
        productType: product.productType,
        quantity,
        sku: product.sku,
        total: unitPrice * quantity,
        unitPrice,
      });
    }

    const affiliation = await loadApprovedAffiliation({
      clubId,
      userId: req.auth.userId,
    });

    if (hasRaceEssentials) {
      if (!affiliation?._id) {
        return res.status(403).json({
          error: "Race essentials require a linked and approved fancier profile.",
        });
      }

      if (!normalizeText(req.body?.selectedLoftName)) {
        return res.status(400).json({
          error: "Race essentials require the selected loft name.",
        });
      }

      if (!normalizeText(req.body?.registeredAccount)) {
        return res.status(400).json({
          error: "Race essentials require a selected registered account.",
        });
      }
    }

    const subtotal = orderItems.reduce((total, item) => total + item.total, 0);
    const orderNumber = buildReference("SHOP");
    const paymentMethod = req.body?.paymentMethod || "gcash";
    const paymentStatus = paymentMethod === "club_credit" ? "paid" : "pending";
    const orderStatus = paymentStatus === "paid" ? "paid" : "pending";

    if (paymentMethod === "club_credit") {
      await applyClubCreditPayment({ amount: subtotal, clubId, orderNumber, req });
    }

    const order = await CommerceShopOrders.create({
      affiliation: affiliation?._id,
      buyer: req.auth.userId,
      club: clubId,
      currency: "PHP",
      fulfillment: {
        pickupLocation:
          normalizeText(req.body?.pickupLocation) ||
          normalizeText((await Clubs.findById(clubId).select("name").lean())?.name) ||
          "Club loading site",
      },
      items: orderItems,
      orderNumber,
      orderStatus,
      paymentMethod,
      paymentReference: normalizeText(req.body?.paymentReference),
      paymentStatus,
      qr: {
        token: buildReference("QR"),
      },
      raceEssentials: {
        fancierProfileLinked: Boolean(affiliation?._id),
        registeredAccount: normalizeText(req.body?.registeredAccount || req.auth?.user?.email),
        selectedLoftName: normalizeText(req.body?.selectedLoftName),
      },
      subtotal,
      totalAmount: subtotal,
    });

    await Promise.all(
      orderItems.map((item) =>
        CommerceShopProducts.updateOne(
          { _id: item.product, status: { $ne: "preorder" } },
          { $inc: { stockQuantity: item.quantity * -1 } },
        ),
      ),
    );

    if (paymentStatus === "paid") {
      await incrementPaidSales(order);
    }

    await logShopAudit(req, {
      action: "shop_checkout",
      clubId,
      metadata: { orderNumber, paymentMethod, totalAmount: subtotal },
      target: orderNumber,
    });

    const payload = await populateOrder(CommerceShopOrders.findById(order._id)).lean({
      virtuals: true,
    });

    return res.status(201).json({
      payload: serializeOrder(payload),
      success: "Club shop checkout completed successfully",
    });
  } catch (error) {
    return sendError(res, error);
  }
};

const getOrderQueryForRole = (req, clubId) => {
  const query = {
    club: clubId,
    deletedAt: { $exists: false },
  };

  if (!canManageShop(req.auth, clubId)) {
    query.buyer = req.auth.userId;
  }

  if (req.query?.status) {
    query.orderStatus = req.query.status;
  }

  return query;
};

export const findShopOrders = async (req, res) => {
  try {
    const clubId = await getShopClubId(req, res);

    if (clubId === null) return null;

    const payload = await populateOrder(
      CommerceShopOrders.find(getOrderQueryForRole(req, clubId)),
    )
      .sort({ createdAt: -1 })
      .lean({ virtuals: true });

    return res.json({
      payload: payload.map(serializeOrder),
      success: "Club shop orders fetched successfully",
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const findMyShopOrders = async (req, res) => {
  try {
    const clubId = await getShopClubId(req, res);

    if (clubId === null) return null;

    const payload = await populateOrder(
      CommerceShopOrders.find({
        buyer: req.auth.userId,
        club: clubId,
        deletedAt: { $exists: false },
      }),
    )
      .sort({ createdAt: -1 })
      .lean({ virtuals: true });

    return res.json({
      payload: payload.map(serializeOrder),
      success: "My club shop purchases fetched successfully",
    });
  } catch (error) {
    return sendError(res, error);
  }
};

const loadScopedOrder = async (req, res, { orderId, token } = {}) => {
  const query = token
    ? { "qr.token": token, deletedAt: { $exists: false } }
    : { _id: orderId, deletedAt: { $exists: false } };
  const order = await CommerceShopOrders.findOne(query);

  if (!order) {
    return { error: res.status(404).json({ error: "Shop order not found." }) };
  }

  const clubId = normalizeTenantId(order.club);

  if (!canAccessTenantClub(req.auth, clubId)) {
    await denyTenantAccess(req, res, {
      attemptedClubId: clubId,
      reason: "Shop order request targeted another club.",
    });
    return { error: true };
  }

  if (!canManageShop(req.auth, clubId) && normalizeTenantId(order.buyer) !== normalizeTenantId(req.auth.userId)) {
    await denyTenantAccess(req, res, {
      attemptedClubId: clubId,
      reason: "Shop order request targeted another buyer.",
    });
    return { error: true };
  }

  return { clubId, order };
};

export const updateShopOrderPayment = async (req, res) => {
  try {
    const { clubId, error, order } = await loadScopedOrder(req, res, {
      orderId: req.params.orderId,
    });

    if (error) return null;

    if (!canManageShop(req.auth, clubId)) {
      return denyTenantAccess(req, res, {
        attemptedClubId: clubId,
        reason: "Payment update attempted without club store permissions.",
      });
    }

    const previousStatus = order.paymentStatus;
    order.paymentStatus = req.body?.paymentStatus || "paid";
    order.paymentReference = normalizeText(req.body?.paymentReference || order.paymentReference);

    if (order.paymentStatus === "paid" && order.orderStatus === "pending") {
      order.orderStatus = "paid";
    }

    if (order.paymentStatus === "refunded") {
      order.orderStatus = "refunded";
      order.refundedAt = new Date();
    }

    await order.save();

    if (previousStatus !== "paid" && order.paymentStatus === "paid") {
      await incrementPaidSales(order);
    }

    await logShopAudit(req, {
      action: "payment_update",
      clubId,
      metadata: {
        orderNumber: order.orderNumber,
        paymentStatus: order.paymentStatus,
      },
      target: order.orderNumber,
    });

    const payload = await populateOrder(CommerceShopOrders.findById(order._id)).lean({
      virtuals: true,
    });

    return res.json({
      payload: serializeOrder(payload),
      success: "Shop order payment updated successfully",
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const cancelShopOrder = async (req, res) => {
  try {
    const { clubId, error, order } = await loadScopedOrder(req, res, {
      orderId: req.params.orderId,
    });

    if (error) return null;

    if (
      normalizeTenantId(order.buyer) !== normalizeTenantId(req.auth.userId) &&
      !canManageShop(req.auth, clubId)
    ) {
      return denyTenantAccess(req, res, {
        attemptedClubId: clubId,
        reason: "Shop order cancellation attempted without ownership or store permissions.",
      });
    }

    if (order.orderStatus === "delivered") {
      return res.status(400).json({ error: "Delivered orders cannot be cancelled." });
    }

    const shouldRestoreStock = !order.cancelledAt && order.orderStatus !== "refunded";
    order.orderStatus = order.paymentStatus === "paid" ? "refunded" : "cancelled";
    order.paymentStatus = order.paymentStatus === "paid" ? "refunded" : order.paymentStatus;
    order.cancelledAt = order.cancelledAt || new Date();
    order.refundedAt = order.orderStatus === "refunded" ? new Date() : order.refundedAt;
    await order.save();

    if (shouldRestoreStock) {
      await Promise.all(
        (order.items || []).map((item) =>
          CommerceShopProducts.updateOne(
            { _id: item.product },
            { $inc: { stockQuantity: Number(item.quantity || 0) } },
          ),
        ),
      );
    }

    await logShopAudit(req, {
      action: order.orderStatus === "refunded" ? "refund" : "order_cancellation",
      clubId,
      metadata: { orderNumber: order.orderNumber },
      target: order.orderNumber,
    });

    const payload = await populateOrder(CommerceShopOrders.findById(order._id)).lean({
      virtuals: true,
    });

    return res.json({
      payload: serializeOrder(payload),
      success: "Shop order status updated successfully",
    });
  } catch (error) {
    return sendError(res, error);
  }
};

const assignRfidSerials = async ({ clubId, order, req }) => {
  const assignments = [];

  for (const item of order.items || []) {
    if (item.category !== "race_essentials" || item.productType !== "rfid_rings") {
      continue;
    }

    if (item.rfidSerials?.length) {
      assignments.push(...item.rfidSerials);
      continue;
    }

    const product = await CommerceShopProducts.findById(item.product);

    if (!product) {
      continue;
    }

    const nextSerial = Number(product.rfid?.nextSerial || 1);
    const prefix = normalizeText(product.rfid?.prefix || "AGT-RFID").toUpperCase();
    const serials = Array.from({ length: Number(item.quantity || 0) }, (_, index) =>
      `${prefix}-${String(nextSerial + index).padStart(6, "0")}`,
    );

    product.rfid = {
      ...(product.rfid?.toObject?.() || product.rfid || {}),
      autoAssign: true,
      nextSerial: nextSerial + serials.length,
      prefix,
    };
    await product.save();

    item.rfidSerials = serials;
    assignments.push(...serials);

    await CommerceRfidAssignments.insertMany(
      serials.map((serialNumber) => ({
        affiliation: order.affiliation,
        assignedBy: req.auth.userId,
        club: clubId,
        fancier: order.buyer,
        loftName: order.raceEssentials?.selectedLoftName,
        order: order._id,
        product: product._id,
        serialNumber,
        // TODO: When Bird/My Loft schemas expose an RFID field, mirror this serial there.
        syncNotes: "Assigned during shop fulfillment and ready for bird registration sync.",
      })),
      { ordered: false },
    ).catch(() => null);
  }

  if (assignments.length) {
    await order.save();
  }

  return assignments;
};

export const scanFulfillmentQr = async (req, res) => {
  try {
    const token = normalizeText(req.body?.qrToken || req.body?.token || req.query?.token);

    if (!token) {
      return res.status(400).json({
        payload: { tone: "red", valid: false },
        error: "QR token is required.",
      });
    }

    const { clubId, error, order } = await loadScopedOrder(req, res, { token });

    if (error) return null;

    if (!canManageShop(req.auth, clubId)) {
      return denyTenantAccess(req, res, {
        attemptedClubId: clubId,
        reason: "Fulfillment QR scan attempted without secretary/store permissions.",
      });
    }

    const isValid =
      order.paymentStatus === "paid" &&
      !["cancelled", "refunded"].includes(order.orderStatus);

    return res.json({
      payload: {
        message: isValid
          ? "Paid, verified, valid order."
          : "Unpaid, cancelled, refunded, or invalid order.",
        order: serializeOrder(order.toObject()),
        tone: isValid ? "green" : "red",
        valid: isValid,
      },
      success: "Fulfillment QR validated successfully",
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const fulfillShopOrder = async (req, res) => {
  try {
    const { clubId, error, order } = await loadScopedOrder(req, res, {
      orderId: req.params.orderId,
    });

    if (error) return null;

    if (!canManageShop(req.auth, clubId)) {
      return denyTenantAccess(req, res, {
        attemptedClubId: clubId,
        reason: "Shop fulfillment attempted without secretary/store permissions.",
      });
    }

    if (order.paymentStatus !== "paid") {
      return res.status(400).json({ error: "Only paid orders can be released." });
    }

    if (["cancelled", "refunded"].includes(order.orderStatus)) {
      return res.status(400).json({ error: "Cancelled or refunded orders cannot be released." });
    }

    const assignedSerials = await assignRfidSerials({ clubId, order, req });

    order.orderStatus = "delivered";
    order.fulfillment = {
      ...(order.fulfillment?.toObject?.() || order.fulfillment || {}),
      deliveredAt: new Date(),
      notes: normalizeText(req.body?.notes),
      releasedAt: new Date(),
      releasedBy: req.auth.userId,
    };
    await order.save();

    await logShopAudit(req, {
      action: "fulfillment",
      clubId,
      metadata: {
        orderNumber: order.orderNumber,
        rfidSerials: assignedSerials,
      },
      target: order.orderNumber,
    });

    if (assignedSerials.length) {
      await logShopAudit(req, {
        action: "rfid_assignment",
        clubId,
        metadata: {
          orderNumber: order.orderNumber,
          rfidSerials: assignedSerials,
        },
        target: order.orderNumber,
      });
    }

    const payload = await populateOrder(CommerceShopOrders.findById(order._id)).lean({
      virtuals: true,
    });

    return res.json({
      payload: {
        order: serializeOrder(payload),
        rfidSerials: assignedSerials,
      },
      success: "Shop order fulfilled successfully",
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const getShopAnalytics = async (req, res) => {
  try {
    const clubId = await getShopClubId(req, res);

    if (clubId === null) return null;

    if (!canManageShop(req.auth, clubId)) {
      return denyTenantAccess(req, res, {
        attemptedClubId: clubId,
        reason: "Shop analytics requested without store permissions.",
      });
    }

    const [products, orders] = await Promise.all([
      CommerceShopProducts.find({
        club: clubId,
        deletedAt: { $exists: false },
      }).lean(),
      CommerceShopOrders.find({
        club: clubId,
        deletedAt: { $exists: false },
      }).lean(),
    ]);
    const paidOrders = orders.filter((order) => order.paymentStatus === "paid");
    const deliveredOrders = orders.filter((order) => order.orderStatus === "delivered");
    const totalSales = paidOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const dailyRevenue = paidOrders
      .filter((order) => new Date(order.updatedAt || order.createdAt) >= startOfDay)
      .reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
    const bestSellingProducts = [...products]
      .sort((left, right) => Number(right.salesCount || 0) - Number(left.salesCount || 0))
      .slice(0, 5)
      .map(serializeProduct);

    return res.json({
      payload: {
        bestSellingProducts,
        dailyRevenue,
        deliveredOrders: deliveredOrders.length,
        lowStockItems: products.filter(
          (product) =>
            Number(product.stockQuantity || 0) > 0 &&
            Number(product.stockQuantity || 0) <= Number(product.lowStockThreshold || 0),
        ).length,
        pendingOrders: orders.filter((order) => order.orderStatus === "pending").length,
        pendingPayments: orders.filter((order) => order.paymentStatus === "pending").length,
        refundRequests: orders.filter((order) => order.orderStatus === "refunded").length,
        totalProducts: products.length,
        totalSales,
      },
      success: "Club shop analytics fetched successfully",
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const findShopAuditLogs = async (req, res) => {
  try {
    const clubId = await getShopClubId(req, res);

    if (clubId === null) return null;

    if (!canManageShop(req.auth, clubId)) {
      return denyTenantAccess(req, res, {
        attemptedClubId: clubId,
        reason: "Shop audit logs requested without store permissions.",
      });
    }

    const payload = await CommerceShopAuditLogs.find({ club: clubId })
      .populate("user", "fullName email mobile")
      .sort({ createdAt: -1 })
      .limit(80)
      .lean();

    return res.json({
      payload,
      success: "Club shop audit logs fetched successfully",
    });
  } catch (error) {
    return sendError(res, error);
  }
};
