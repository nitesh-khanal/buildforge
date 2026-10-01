jest.mock('../models/User', () => ({ findById: jest.fn() }));
jest.mock('../models/Order', () => ({ find: jest.fn(), countDocuments: jest.fn(), aggregate: jest.fn() }));
jest.mock('../models/Product', () => ({ findActive: jest.fn(), countDocuments: jest.fn(), activeFilter: (filter) => ({ ...filter, isArchived: { $ne: true } }) }));

const User = require('../models/User');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { getUser } = require('../controllers/adminUserController');
const { getProducts } = require('../controllers/productController');

function invoke(handler, req) {
  return new Promise((resolve, reject) => {
    const response = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(body) { resolve({ status: this.statusCode, body }); },
    };
    handler(req, response, reject);
  });
}

beforeEach(() => jest.clearAllMocks());

it('reports lifetime spending separately from the last 20 orders', async () => {
  User.findById.mockResolvedValue({ _id: 'user-id', name: 'Customer' });
  const recent = Array.from({ length: 20 }, () => ({ total: 100, paymentStatus: 'Paid' }));
  Order.find.mockReturnValue({ sort: () => ({ limit: () => Promise.resolve(recent) }) });
  Order.countDocuments.mockResolvedValue(25);
  Order.aggregate.mockResolvedValue([{ totalSpent: 2500 }]);
  const response = await invoke(getUser, { params: { id: 'user-id' } });
  expect(response.status).toBe(200);
  expect(response.body).toMatchObject({ orderCount: 25, totalSpent: 2500 });
  expect(response.body.recentOrders).toHaveLength(20);
  expect(Order.aggregate).toHaveBeenCalledWith([
    { $match: { user: 'user-id', paymentStatus: { $in: ['Paid', 'COD'] } } },
    { $group: { _id: null, totalSpent: { $sum: '$total' } } },
  ]);
});

it('reports zero spending for a customer without confirmed orders', async () => {
  User.findById.mockResolvedValue({ _id: 'user-id' });
  Order.find.mockReturnValue({ sort: () => ({ limit: () => Promise.resolve([]) }) });
  Order.countDocuments.mockResolvedValue(0);
  Order.aggregate.mockResolvedValue([]);
  const response = await invoke(getUser, { params: { id: 'user-id' } });
  expect(response.body.totalSpent).toBe(0);
});

it('counts the same specification-filtered products that the listing displays', async () => {
  const query = {
    find: jest.fn().mockReturnThis(), sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(),
    then: (resolve) => Promise.resolve([{ name: 'AM5 board' }]).then(resolve),
  };
  Product.findActive.mockReturnValue(query);
  Product.countDocuments.mockResolvedValue(1);
  const response = await invoke(getProducts, { query: { category: 'motherboard', 'spec.socket': 'AM5', limit: '24' } });
  expect(response.status).toBe(200);
  expect(response.body).toMatchObject({ total: 1, pages: 1, count: 1 });
  expect(Product.countDocuments).toHaveBeenCalledWith({
    category: 'motherboard', 'specifications.socket': 'AM5', isArchived: { $ne: true },
  });
});
