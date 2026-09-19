/**
 * AI Water Controller — Cloud Orders + Reviews + Steadfast
 * -------------------------------------------------------
 * সেটআপ (একবার):
 * 1) https://script.google.com → New project
 * 2) এই পুরো কোড পেস্ট করুন → Save
 * 3) Run → setup → Allow
 * 4) Deploy → Web app → Anyone → Deploy → /exec URL কপি
 * 5) Admin → Order Sync এ URL → Test Sync → site-config.js আপলোড
 * 6) Admin → Steadfast → API Key + Secret Key সেভ
 *
 * কোড বদলালে: Manage deployments → New version → Deploy
 */

/** একবার Editor থেকে Run করুন — Sheet তৈরি + অনুমতি। */
function setup() {
  var sheet = getSheet_();
  getReviewsSheet_();
  Logger.log('OK sheet: ' + sheet.getParent().getUrl());
}

/**
 * Optional fallback: Editor থেকে Key সেট করতে চাইলে এখানে বসিয়ে Run করুন।
 * Preferred: Admin panel → Steadfast → Save API Keys
 */
function setSteadfastCredentials() {
  var API_KEY = 'YOUR_STEADFAST_API_KEY';
  var SECRET_KEY = 'YOUR_STEADFAST_SECRET_KEY';
  if (API_KEY.indexOf('YOUR_') === 0 || SECRET_KEY.indexOf('YOUR_') === 0) {
    throw new Error('Use Admin panel Steadfast form, or put keys here and Run again');
  }
  PropertiesService.getScriptProperties().setProperties({
    STEADFAST_API_KEY: String(API_KEY).trim(),
    STEADFAST_SECRET_KEY: String(SECRET_KEY).trim()
  });
  Logger.log('Steadfast credentials saved');
}

function saveSteadfastKeys_(apiKey, secretKey) {
  apiKey = String(apiKey || '').trim();
  secretKey = String(secretKey || '').trim();
  if (!apiKey || !secretKey) {
    throw new Error('API Key and Secret Key are required');
  }
  if (apiKey.indexOf('YOUR_') === 0 || secretKey.indexOf('YOUR_') === 0) {
    throw new Error('Replace placeholder keys with real Steadfast keys');
  }
  PropertiesService.getScriptProperties().setProperties({
    STEADFAST_API_KEY: apiKey,
    STEADFAST_SECRET_KEY: secretKey
  });
}

function steadfastStatus() {
  var props = PropertiesService.getScriptProperties();
  var hasKey = !!props.getProperty('STEADFAST_API_KEY');
  var hasSecret = !!props.getProperty('STEADFAST_SECRET_KEY');
  Logger.log('API Key: ' + (hasKey ? 'OK' : 'MISSING'));
  Logger.log('Secret Key: ' + (hasSecret ? 'OK' : 'MISSING'));
}

var SHEET_NAME = 'Orders';
var REVIEWS_SHEET_NAME = 'Reviews';
var PROP_SS_ID = 'ORDERS_SPREADSHEET_ID';
var STEADFAST_API = 'https://portal.packzy.com/api/v1/create_order';
var ORDER_HEADERS = [
  'id', 'createdAt', 'formattedTime', 'name', 'phone', 'address', 'note',
  'packageName', 'cableFeet', 'controllerPrice', 'sensorPrice', 'cablePrice',
  'totalPrice', 'status', 'confirmedAt', 'steadfastTracking', 'steadfastConsignmentId',
  'courierName', 'consignmentNo', 'courierCharge', 'shippingNote'
];

function getSheet_() {
  var props = PropertiesService.getScriptProperties();
  var ssId = props.getProperty(PROP_SS_ID);
  var ss = null;

  if (ssId) {
    try {
      ss = SpreadsheetApp.openById(ssId);
    } catch (e) {
      ss = null;
    }
  }

  if (!ss) {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  }

  if (!ss) {
    ss = SpreadsheetApp.create('AI-Controller-Orders');
  }

  props.setProperty(PROP_SS_ID, ss.getId());

  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(ORDER_HEADERS);
  } else {
    ensureOrderHeaders_(sheet);
  }
  return sheet;
}

function ensureOrderHeaders_(sheet) {
  var needed = ORDER_HEADERS.length;
  var lastCol = Math.max(sheet.getLastColumn(), needed);
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  for (var i = 0; i < needed; i++) {
    if (String(headers[i] || '') !== ORDER_HEADERS[i]) {
      sheet.getRange(1, 1, 1, needed).setValues([ORDER_HEADERS]);
      break;
    }
  }
}

function orderToRow_(order) {
  return [
    order.id, order.createdAt, order.formattedTime, order.name, order.phone,
    order.address, order.note, order.packageName, order.cableFeet,
    order.controllerPrice, order.sensorPrice, order.cablePrice,
    order.totalPrice, order.status, order.confirmedAt || '',
    order.steadfastTracking || '', order.steadfastConsignmentId || '',
    order.courierName || '', order.consignmentNo || '',
    order.courierCharge != null ? order.courierCharge : '',
    order.shippingNote || ''
  ];
}

function normalizeBdPhone_(phone) {
  var digits = String(phone || '').replace(/[^0-9]/g, '');
  if (digits.indexOf('88') === 0 && digits.length >= 13) digits = digits.substring(digits.length - 11);
  if (digits.length === 10) digits = '0' + digits;
  return digits;
}

function rowsToOrders_(sheet) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0];
  var orders = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[0]) continue;
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      obj[headers[c]] = row[c];
    }
    obj.cableFeet = Number(obj.cableFeet) || 0;
    obj.controllerPrice = Number(obj.controllerPrice) || 0;
    obj.sensorPrice = Number(obj.sensorPrice) || 0;
    obj.cablePrice = Number(obj.cablePrice) || 0;
    obj.totalPrice = Number(obj.totalPrice) || 0;
    obj.confirmedAt = obj.confirmedAt || null;
    obj.steadfastTracking = obj.steadfastTracking || '';
    obj.steadfastConsignmentId = obj.steadfastConsignmentId || '';
    obj.courierName = obj.courierName || '';
    obj.consignmentNo = obj.consignmentNo || '';
    obj.courierCharge = obj.courierCharge === '' || obj.courierCharge == null ? '' : Number(obj.courierCharge);
    obj.shippingNote = obj.shippingNote || '';
    orders.push(obj);
  }
  // newest first
  orders.sort(function (a, b) {
    return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
  });
  return orders;
}

function findRowIndex_(sheet, id) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) return i + 1; // 1-based
  }
  return -1;
}

function getReviewsSheet_() {
  var ordersSheet = getSheet_();
  var ss = ordersSheet.getParent();
  var sheet = ss.getSheetByName(REVIEWS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(REVIEWS_SHEET_NAME);
    sheet.appendRow(['id', 'createdAt', 'name', 'comment']);
  }
  return sheet;
}

function rowsToReviews_(sheet) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0];
  var reviews = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[0]) continue;
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      obj[headers[c]] = row[c];
    }
    obj.type = 'text';
    reviews.push(obj);
  }
  reviews.sort(function (a, b) {
    return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
  });
  return reviews;
}

function findReviewRowIndex_(sheet, id) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) return i + 1;
  }
  return -1;
}

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function parseBody_(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  try {
    return JSON.parse(e.postData.contents);
  } catch (err) {
    return {};
  }
}

function doGet(e) {
  try {
    var kind = (e && e.parameter && e.parameter.type) ? String(e.parameter.type) : 'orders';
    if (kind === 'reviews') {
      var reviews = rowsToReviews_(getReviewsSheet_());
      return jsonOut_({ success: true, reviews: reviews });
    }
    var sheet = getSheet_();
    var orders = rowsToOrders_(sheet);
    return jsonOut_({ success: true, orders: orders });
  } catch (err) {
    return jsonOut_({ success: false, error: String(err) });
  }
}

function doPost(e) {
  try {
    var body = parseBody_(e);
    var action = body.action || 'create';
    var sheet = getSheet_();

    if (action === 'list') {
      return jsonOut_({ success: true, orders: rowsToOrders_(sheet) });
    }

    if (action === 'create') {
      var now = new Date();
      var order = {
        id: body.id || ('ORD-' + Math.floor(100000 + Math.random() * 900000)),
        createdAt: body.createdAt || now.toISOString(),
        formattedTime: body.formattedTime || Utilities.formatDate(now, 'Asia/Dhaka', 'yyyy-MM-dd HH:mm:ss'),
        name: body.name || '',
        phone: body.phone || '',
        address: body.address || '',
        note: body.note || '',
        packageName: body.packageName || 'AI Controller + Premium Sensor',
        cableFeet: Number(body.cableFeet) || 0,
        controllerPrice: Number(body.controllerPrice) || 0,
        sensorPrice: Number(body.sensorPrice) || 0,
        cablePrice: Number(body.cablePrice) || 0,
        totalPrice: Number(body.totalPrice) || 0,
        status: body.status || 'pending',
        confirmedAt: body.confirmedAt || '',
        steadfastTracking: '',
        steadfastConsignmentId: '',
        courierName: '',
        consignmentNo: '',
        courierCharge: '',
        shippingNote: ''
      };
      sheet.appendRow(orderToRow_(order));
      return jsonOut_({ success: true, order: order, message: 'অর্ডার সেভ হয়েছে' });
    }

    if (action === 'update') {
      var id = body.id;
      var row = findRowIndex_(sheet, id);
      if (row < 0) return jsonOut_({ success: false, error: 'অর্ডার পাওয়া যায়নি' });
      var orders = rowsToOrders_(sheet);
      var existing = null;
      for (var i = 0; i < orders.length; i++) {
        if (String(orders[i].id) === String(id)) existing = orders[i];
      }
      if (!existing) return jsonOut_({ success: false, error: 'অর্ডার পাওয়া যায়নি' });

      if (body.status) {
        existing.status = body.status;
        if (body.status === 'confirmed' && !existing.confirmedAt) {
          existing.confirmedAt = new Date().toISOString();
        }
      }
      if (body.name !== undefined) existing.name = body.name;
      if (body.phone !== undefined) existing.phone = body.phone;
      if (body.address !== undefined) existing.address = body.address;
      if (body.note !== undefined) existing.note = body.note;
      if (body.adminNote !== undefined) existing.note = body.adminNote;
      if (body.cableFeet !== undefined) existing.cableFeet = Number(body.cableFeet) || 0;
      if (body.controllerPrice !== undefined) existing.controllerPrice = Number(body.controllerPrice) || 0;
      if (body.sensorPrice !== undefined) existing.sensorPrice = Number(body.sensorPrice) || 0;
      if (body.cablePrice !== undefined) existing.cablePrice = Number(body.cablePrice) || 0;
      if (body.totalPrice !== undefined) existing.totalPrice = Number(body.totalPrice) || 0;
      if (body.steadfastTracking !== undefined) existing.steadfastTracking = body.steadfastTracking;
      if (body.steadfastConsignmentId !== undefined) existing.steadfastConsignmentId = body.steadfastConsignmentId;
      if (body.courierName !== undefined) existing.courierName = body.courierName;
      if (body.consignmentNo !== undefined) existing.consignmentNo = body.consignmentNo;
      if (body.courierCharge !== undefined) existing.courierCharge = body.courierCharge;
      if (body.shippingNote !== undefined) existing.shippingNote = body.shippingNote;

      sheet.getRange(row, 1, 1, 21).setValues([orderToRow_(existing)]);
      return jsonOut_({ success: true, order: existing });
    }

    if (action === 'delete') {
      var delId = body.id;
      var delRow = findRowIndex_(sheet, delId);
      if (delRow < 0) return jsonOut_({ success: false, error: 'অর্ডার পাওয়া যায়নি' });
      sheet.deleteRow(delRow);
      return jsonOut_({ success: true, message: 'মুছে ফেলা হয়েছে' });
    }

    if (action === 'listReviews') {
      return jsonOut_({ success: true, reviews: rowsToReviews_(getReviewsSheet_()) });
    }

    if (action === 'createReview') {
      var rSheet = getReviewsSheet_();
      var rNow = new Date();
      var review = {
        id: body.id || ('REV-' + Math.floor(100000 + Math.random() * 900000)),
        createdAt: body.createdAt || rNow.toISOString(),
        name: body.name || '',
        comment: body.comment || '',
        type: 'text'
      };
      if (!review.comment) return jsonOut_({ success: false, error: 'কমেন্ট খালি' });
      rSheet.appendRow([review.id, review.createdAt, review.name, review.comment]);
      return jsonOut_({ success: true, review: review, reviews: rowsToReviews_(rSheet) });
    }

    if (action === 'deleteReview') {
      var rDelSheet = getReviewsSheet_();
      var rDelRow = findReviewRowIndex_(rDelSheet, body.id);
      if (rDelRow < 0) return jsonOut_({ success: false, error: 'রিভিউ পাওয়া যায়নি' });
      rDelSheet.deleteRow(rDelRow);
      return jsonOut_({ success: true, message: 'রিভিউ মুছে ফেলা হয়েছে', reviews: rowsToReviews_(rDelSheet) });
    }

    if (action === 'steadfastStatus') {
      var sProps = PropertiesService.getScriptProperties();
      return jsonOut_({
        success: true,
        configured: !!(sProps.getProperty('STEADFAST_API_KEY') && sProps.getProperty('STEADFAST_SECRET_KEY'))
      });
    }

    if (action === 'setSteadfastCredentials') {
      try {
        saveSteadfastKeys_(body.apiKey, body.secretKey);
      } catch (credErr) {
        return jsonOut_({ success: false, error: String(credErr.message || credErr) });
      }
      return jsonOut_({
        success: true,
        configured: true,
        message: 'Steadfast API keys saved securely on server'
      });
    }

    if (action === 'sendSteadfast') {
      var sfProps = PropertiesService.getScriptProperties();
      var apiKey = sfProps.getProperty('STEADFAST_API_KEY');
      var secretKey = sfProps.getProperty('STEADFAST_SECRET_KEY');
      if (!apiKey || !secretKey) {
        return jsonOut_({
          success: false,
          error: 'Steadfast API Key not set. Open Admin → Order Sync → Steadfast and save keys.'
        });
      }

      var sfOrders = rowsToOrders_(sheet);
      var sfOrder = null;
      for (var si = 0; si < sfOrders.length; si++) {
        if (String(sfOrders[si].id) === String(body.id)) sfOrder = sfOrders[si];
      }
      if (!sfOrder && body.order) sfOrder = body.order;
      if (!sfOrder) return jsonOut_({ success: false, error: 'অর্ডার পাওয়া যায়নি' });

      var phone11 = normalizeBdPhone_(sfOrder.phone);
      if (phone11.length !== 11) {
        return jsonOut_({ success: false, error: 'মোবাইল নম্বর ১১ ডিজিট হতে হবে (01XXXXXXXXX)' });
      }

      var invoice = String(sfOrder.id || '').replace(/[^a-zA-Z0-9_-]/g, '');
      if (!invoice) invoice = 'ORD-' + Date.now();

      var payload = {
        invoice: invoice,
        recipient_name: String(sfOrder.name || '').substring(0, 100),
        recipient_phone: phone11,
        recipient_address: String(sfOrder.address || '').substring(0, 250),
        cod_amount: Number(sfOrder.totalPrice) || 0,
        note: String(sfOrder.note || '').substring(0, 480),
        item_description: 'AI Water Controller + Premium Sensor + Cable ' + (sfOrder.cableFeet || 0) + 'ft',
        total_lot: 1,
        delivery_type: 0
      };

      var sfRes = UrlFetchApp.fetch(STEADFAST_API, {
        method: 'post',
        contentType: 'application/json',
        headers: {
          'Api-Key': apiKey,
          'Secret-Key': secretKey
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });

      var sfCode = sfRes.getResponseCode();
      var sfText = sfRes.getContentText();
      var sfJson = {};
      try { sfJson = JSON.parse(sfText); } catch (parseErr) {
        return jsonOut_({ success: false, error: 'Steadfast invalid response: ' + sfText });
      }

      if (sfCode >= 400 || (sfJson.status && Number(sfJson.status) >= 400)) {
        return jsonOut_({
          success: false,
          error: (sfJson.message || sfJson.error || ('Steadfast error ' + sfCode))
        });
      }

      var consignment = sfJson.consignment || sfJson.data || {};
      var tracking = consignment.tracking_code || sfJson.tracking_code || '';
      var consignmentId = consignment.consignment_id || sfJson.consignment_id || '';

      sfOrder.steadfastTracking = tracking;
      sfOrder.steadfastConsignmentId = String(consignmentId || '');
      sfOrder.courierName = sfOrder.courierName || 'Steadfast';
      sfOrder.consignmentNo = tracking || sfOrder.consignmentNo || '';
      if (sfOrder.status === 'confirmed' || sfOrder.status === 'processing' || sfOrder.status === 'ready_to_ship') {
        sfOrder.status = 'shipped';
      }

      var sfRow = findRowIndex_(sheet, sfOrder.id);
      if (sfRow > 0) {
        sheet.getRange(sfRow, 1, 1, 21).setValues([orderToRow_(sfOrder)]);
      }

      return jsonOut_({
        success: true,
        message: 'Steadfast-এ পাঠানো হয়েছে',
        order: sfOrder,
        tracking: tracking,
        consignmentId: consignmentId,
        steadfast: sfJson
      });
    }

    return jsonOut_({ success: false, error: 'Unknown action' });
  } catch (err) {
    return jsonOut_({ success: false, error: String(err) });
  }
}
