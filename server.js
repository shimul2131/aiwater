const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 5173;
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const REVIEWS_FILE = path.join(DATA_DIR, 'reviews.json');
const REVIEWS_DIR = path.join(ROOT_DIR, 'assets', 'reviews');

// Ensure data folder and files exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(REVIEWS_DIR)) {
  fs.mkdirSync(REVIEWS_DIR, { recursive: true });
}
if (!fs.existsSync(ORDERS_FILE)) {
  fs.writeFileSync(ORDERS_FILE, JSON.stringify([], null, 2), 'utf8');
}
if (!fs.existsSync(REVIEWS_FILE)) {
  fs.writeFileSync(REVIEWS_FILE, JSON.stringify([], null, 2), 'utf8');
}

function getOrders() {
  try {
    const raw = fs.readFileSync(ORDERS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading orders:', err);
    return [];
  }
}

function saveOrders(orders) {
  try {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error saving orders:', err);
    return false;
  }
}

function getReviews() {
  try {
    const raw = fs.readFileSync(REVIEWS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading reviews:', err);
    return [];
  }
}

function saveReviews(reviews) {
  try {
    fs.writeFileSync(REVIEWS_FILE, JSON.stringify(reviews, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error saving reviews:', err);
    return false;
  }
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

function readBody(req, maxBytes) {
  const limit = maxBytes || 1e6;
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > limit) {
        req.destroy();
        reject(new Error('Body too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname || '/';

  // Support /watercontroller subpath (e.g. aicontroller.store/watercontroller/...)
  const SUBPATH = '/watercontroller';
  if (pathname === SUBPATH) {
    res.writeHead(301, {
      Location: SUBPATH + '/' + (parsedUrl.search || '')
    });
    res.end();
    return;
  }
  if (pathname.startsWith(SUBPATH + '/')) {
    pathname = pathname.slice(SUBPATH.length);
    if (!pathname) pathname = '/';
  }

  // ===== API ROUTES =====

  // GET /api/reviews
  if (pathname === '/api/reviews' && req.method === 'GET') {
    return sendJson(res, 200, { success: true, reviews: getReviews() });
  }

  // POST /api/reviews — upload screenshot (base64) or add path/url
  if (pathname === '/api/reviews' && req.method === 'POST') {
    try {
      const data = await readBody(req, 12e6); // ~12MB for screenshots
      const reviews = getReviews();
      const now = new Date();
      const id = 'REV-' + Date.now();

      let src = (data.src || data.url || '').trim();
      const alt = (data.alt || 'কাস্টমার কমেন্ট').trim();

      if (data.imageBase64) {
        const match = String(data.imageBase64).match(/^data:(image\/(png|jpeg|jpg|webp|gif));base64,(.+)$/i);
        if (!match) {
          return sendJson(res, 400, { success: false, error: 'শুধু PNG/JPG/WEBP ছবি আপলোড করা যাবে' });
        }
        const ext = match[2].toLowerCase() === 'jpeg' ? 'jpg' : match[2].toLowerCase();
        const fileName = 'comment-' + Date.now() + '.' + ext;
        const filePath = path.join(REVIEWS_DIR, fileName);
        fs.writeFileSync(filePath, Buffer.from(match[3], 'base64'));
        src = 'assets/reviews/' + fileName;
      }

      if (!src) {
        return sendJson(res, 400, { success: false, error: 'ছবি বা লিংক দিন' });
      }

      const item = {
        id,
        src,
        alt,
        createdAt: now.toISOString()
      };
      reviews.unshift(item);
      saveReviews(reviews);

      return sendJson(res, 201, { success: true, review: item, reviews });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // DELETE /api/reviews/:id
  if (pathname.startsWith('/api/reviews/') && req.method === 'DELETE') {
    try {
      const id = pathname.split('/').filter(Boolean)[2];
      let reviews = getReviews();
      const target = reviews.find((r) => r.id === id);
      if (!target) {
        return sendJson(res, 404, { success: false, error: 'রিভিউ পাওয়া যায়নি' });
      }

      // Delete local file if under assets/reviews
      if (target.src && target.src.indexOf('assets/reviews/') === 0) {
        const filePath = path.join(ROOT_DIR, target.src.replace(/\//g, path.sep));
        if (fs.existsSync(filePath)) {
          try { fs.unlinkSync(filePath); } catch (e) {}
        }
      }

      reviews = reviews.filter((r) => r.id !== id);
      saveReviews(reviews);
      return sendJson(res, 200, { success: true, reviews });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // GET /api/orders - list all orders
  if (pathname === '/api/orders' && req.method === 'GET') {
    const orders = getOrders();
    return sendJson(res, 200, { success: true, orders });
  }

  // POST /api/orders - customer places an order
  if (pathname === '/api/orders' && req.method === 'POST') {
    try {
      const data = await readBody(req);
      const name = (data.name || '').trim();
      const phone = (data.phone || '').trim();
      const address = (data.address || '').trim();
      const note = (data.note || '').trim();
      const cableFeet = Number(data.cableFeet) || 0;
      const totalPrice = Number(data.totalPrice) || 0;
      const controllerPrice = Number(data.controllerPrice) || 4500;
      const sensorPrice = Number(data.sensorPrice) || 1550;
      const cablePrice = Number(data.cablePrice) || (cableFeet * 8);

      if (!name || !phone || !address) {
        return sendJson(res, 400, {
          success: false,
          error: 'নাম, মোবাইল নম্বর ও ঠিকানা পূরণ করা আবশ্যক'
        });
      }

      const orders = getOrders();
      const now = new Date();
      const orderId = 'ORD-' + Math.floor(100000 + Math.random() * 900000);

      const newOrder = {
        id: orderId,
        createdAt: now.toISOString(),
        formattedTime: now.toLocaleString('en-US', { timeZone: 'Asia/Dhaka' }),
        name,
        phone,
        address,
        note,
        packageName: 'AI Controller + Premium Sensor',
        cableFeet,
        controllerPrice,
        sensorPrice,
        cablePrice,
        totalPrice,
        status: 'pending', // 'pending' | 'confirmed' | 'delivered' | 'cancelled'
        confirmedAt: null
      };

      orders.unshift(newOrder); // newest first
      saveOrders(orders);

      return sendJson(res, 201, {
        success: true,
        message: 'অর্ডার সফলভাবে গ্রহণ করা হয়েছে!',
        order: newOrder
      });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // PATCH /api/orders/:id or POST /api/orders/:id/status - update order status
  if (
    (pathname.startsWith('/api/orders/') && (req.method === 'PATCH' || req.method === 'PUT' || req.method === 'POST'))
  ) {
    try {
      const parts = pathname.split('/').filter(Boolean);
      const id = parts[2]; // /api/orders/:id
      const data = await readBody(req);

      const orders = getOrders();
      const index = orders.findIndex(o => o.id === id);
      if (index === -1) {
        return sendJson(res, 404, { success: false, error: 'অর্ডার পাওয়া যায়নি' });
      }

      const existing = orders[index];
      if (data.status) {
        existing.status = data.status;
        if (data.status === 'confirmed' && !existing.confirmedAt) {
          existing.confirmedAt = new Date().toISOString();
        }
      }
      if (data.adminNote !== undefined) existing.adminNote = data.adminNote;
      if (data.address) existing.address = data.address;
      if (data.phone) existing.phone = data.phone;

      orders[index] = existing;
      saveOrders(orders);

      return sendJson(res, 200, {
        success: true,
        message: 'অর্ডার স্ট্যাটাস আপডেট হয়েছে',
        order: existing
      });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // DELETE /api/orders/:id
  if (pathname.startsWith('/api/orders/') && req.method === 'DELETE') {
    try {
      const parts = pathname.split('/').filter(Boolean);
      const id = parts[2];

      let orders = getOrders();
      const initialLength = orders.length;
      orders = orders.filter(o => o.id !== id);

      if (orders.length === initialLength) {
        return sendJson(res, 404, { success: false, error: 'অর্ডার পাওয়া যায়নি' });
      }

      saveOrders(orders);
      return sendJson(res, 200, { success: true, message: 'অর্ডার মুছে ফেলা হয়েছে' });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // ===== STATIC FILE SERVING =====
  let reqPath = pathname === '/' ? '/index.html' : pathname;
  // Prevent directory traversal
  const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(ROOT_DIR, safePath);

  // If directory, check index.html
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`===============================================`);
  console.log(` AI Water Controller Server Running!`);
  console.log(` Main Website: http://localhost:${PORT}/watercontroller/`);
  console.log(` Admin Panel:  http://localhost:${PORT}/watercontroller/admin.html`);
  console.log(` Root URL:     http://localhost:${PORT}/`);
  console.log(`===============================================`);
});
