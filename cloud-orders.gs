/**
 * AI Water Controller — Cloud Orders (Google Apps Script)
 * -------------------------------------------------------
 * সেটআপ (একবার):
 * 1) https://script.google.com → New project
 * 2) এই পুরো কোড পেস্ট করুন → Save
 * 3) উপরের Run → setup (অনুমতি Allow করুন) — একবার
 * 4) Deploy → New deployment → Type: Web app
 *    - Execute as: Me
 *    - Who has access: Anyone  ← খুব জরুরি
 *      (❌ "Anyone with a Google account" দিলে কাজ করবে না)
 * 5) Deploy → Web app URL (.../exec) কপি করুন
 * 6) Admin → Order Sync → URL → Test Sync → Save → site-config.js আপলোড
 *
 * কোড বদলালে: Deploy → Manage deployments → Edit → New version → Deploy
 *
 * অর্ডার Google Sheet "AI-Controller-Orders" এও সেভ হবে।
 */

/** একবার Editor থেকে Run করুন — Sheet তৈরি + অনুমতি। */
function setup() {
  var sheet = getSheet_();
  Logger.log('OK sheet: ' + sheet.getParent().getUrl());
}

var SHEET_NAME = 'Orders';
var PROP_SS_ID = 'ORDERS_SPREADSHEET_ID';

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
    sheet.appendRow([
      'id', 'createdAt', 'formattedTime', 'name', 'phone', 'address', 'note',
      'packageName', 'cableFeet', 'controllerPrice', 'sensorPrice', 'cablePrice',
      'totalPrice', 'status', 'confirmedAt'
    ]);
  }
  return sheet;
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
        confirmedAt: body.confirmedAt || ''
      };
      sheet.appendRow([
        order.id, order.createdAt, order.formattedTime, order.name, order.phone,
        order.address, order.note, order.packageName, order.cableFeet,
        order.controllerPrice, order.sensorPrice, order.cablePrice,
        order.totalPrice, order.status, order.confirmedAt
      ]);
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

      sheet.getRange(row, 1, 1, 15).setValues([[
        existing.id, existing.createdAt, existing.formattedTime, existing.name, existing.phone,
        existing.address, existing.note, existing.packageName, existing.cableFeet,
        existing.controllerPrice, existing.sensorPrice, existing.cablePrice,
        existing.totalPrice, existing.status, existing.confirmedAt || ''
      ]]);
      return jsonOut_({ success: true, order: existing });
    }

    if (action === 'delete') {
      var delId = body.id;
      var delRow = findRowIndex_(sheet, delId);
      if (delRow < 0) return jsonOut_({ success: false, error: 'অর্ডার পাওয়া যায়নি' });
      sheet.deleteRow(delRow);
      return jsonOut_({ success: true, message: 'মুছে ফেলা হয়েছে' });
    }

    return jsonOut_({ success: false, error: 'Unknown action' });
  } catch (err) {
    return jsonOut_({ success: false, error: String(err) });
  }
}
