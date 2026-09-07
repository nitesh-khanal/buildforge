// Thin wiring layer: injects the real Mongoose models/services into
// esewaSweepService's dependency-injected sweep function. Kept separate
// from esewaSweepService.js itself so that file stays require()-light and
// directly testable (see tests/esewaSweepService.test.js), matching the
// same split couponService.js/orderController.js already have.
const Order = require('../models/Order');
const Product = require('../models/Product');
const Notification = require('../models/Notification');
const esewaService = require('./esewaService');
const orderNotificationService = require('./orderNotificationService');
const notificationService = require('./notificationService');
const { restockOrderItems } = require('../utils/inventory');
const { sweepStalePendingEsewaOrders } = require('./esewaSweepService');

async function runEsewaSweep() {
  return sweepStalePendingEsewaOrders({
    Order,
    Product,
    Notification,
    esewaService,
    restockOrderItems,
    orderNotificationService,
    notificationService,
  });
}

module.exports = { runEsewaSweep };
