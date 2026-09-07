const { checkBuildCompatibility, isBuildOrderable } = require('../services/compatibilityService');

// Minimal fake "Product" objects — the service only reads `.category`,
// `.price`, and `.compatibilityData`, so full Mongoose docs aren't needed.
const am5Cpu = { name: 'Ryzen 5 7600X', price: 42000, compatibilityData: { socket: 'AM5', tdp: 105 } };
const lga1700Cpu = { name: 'i5-13400F', price: 32000, compatibilityData: { socket: 'LGA1700', tdp: 65 } };
const am5Mobo = { name: 'B650-Plus', price: 32000, compatibilityData: { socket: 'AM5', formFactor: 'ATX', ramType: 'DDR5', maxRam: 128 } };
const ddr5Ram = { name: '32GB DDR5', price: 15500, compatibilityData: { type: 'DDR5', capacity: 32 } };
const ddr4Ram = { name: '16GB DDR4', price: 6500, compatibilityData: { type: 'DDR4', capacity: 16 } };
const gpu4060 = { name: 'RTX 4060', price: 48000, compatibilityData: { length: 200, tdp: 115, recommendedPSU: 450 } };
const gpu4090 = { name: 'RTX 4090', price: 280000, compatibilityData: { length: 336, tdp: 450, recommendedPSU: 1000 } };
const atxCase = { name: 'Lancool 216', price: 12500, compatibilityData: { supportedMotherboardSizes: ['ATX', 'Micro-ATX', 'Mini-ITX'], gpuMaxLength: 392, cpuCoolerMaxHeight: 181, psuFormFactor: 'ATX' } };
const itxCase = { name: 'NR200', price: 11000, compatibilityData: { supportedMotherboardSizes: ['Mini-ITX'], gpuMaxLength: 330, cpuCoolerMaxHeight: 155, psuFormFactor: 'SFX' } };
const psu550 = { name: 'MWE 550W', price: 6200, compatibilityData: { wattage: 550, formFactor: 'ATX' } };
const psu1000 = { name: 'HX1000', price: 32000, compatibilityData: { wattage: 1000, formFactor: 'ATX' } };
const airCooler = { name: 'Hyper 212', price: 4200, compatibilityData: { supportedSockets: ['AM5', 'AM4', 'LGA1700'], height: 159, tdpRating: 150 } };
const storage = { name: '1TB NVMe', price: 12500, compatibilityData: { interface: 'M.2 NVMe' } };

describe('compatibilityService', () => {
  it('reports fully compatible for a sensible balanced build', () => {
    const components = {
      cpu: am5Cpu,
      'cpu-cooler': airCooler,
      motherboard: am5Mobo,
      ram: ddr5Ram,
      gpu: gpu4060,
      storage,
      psu: psu550,
      case: atxCase,
    };
    const report = checkBuildCompatibility(components);
    expect(report.status).toBe('compatible');
    expect(isBuildOrderable(components, report)).toBe(true);
  });

  it('flags CPU/motherboard socket mismatch as an error', () => {
    const report = checkBuildCompatibility({ cpu: am5Cpu, motherboard: undefined });
    expect(report.errors.length).toBe(0); // no motherboard selected yet — not an error

    const mismatch = checkBuildCompatibility({
      cpu: lga1700Cpu,
      motherboard: am5Mobo,
    });
    expect(mismatch.status).toBe('error');
    expect(mismatch.errors.some((e) => e.category === 'cpu-motherboard')).toBe(true);
  });

  it('flags DDR generation mismatch between RAM and motherboard', () => {
    const report = checkBuildCompatibility({ ram: ddr4Ram, motherboard: am5Mobo });
    expect(report.status).toBe('error');
    expect(report.errors.some((e) => e.category === 'ram-motherboard')).toBe(true);
  });

  it('flags a motherboard that does not fit the case', () => {
    const report = checkBuildCompatibility({ motherboard: am5Mobo, case: itxCase });
    expect(report.status).toBe('error');
    expect(report.errors.some((e) => e.category === 'motherboard-case')).toBe(true);
  });

  it('flags a GPU that is too long for the case', () => {
    const report = checkBuildCompatibility({ gpu: gpu4090, case: itxCase });
    expect(report.status).toBe('error');
    expect(report.errors.some((e) => e.category === 'gpu-case')).toBe(true);
  });

  it('flags insufficient PSU wattage as an error', () => {
    const report = checkBuildCompatibility({ cpu: am5Cpu, gpu: gpu4090, psu: psu550 });
    expect(report.status).toBe('error');
    expect(report.errors.some((e) => e.category === 'psu-power')).toBe(true);
  });

  it('accepts a well-powered PSU for a high-end build', () => {
    const report = checkBuildCompatibility({ cpu: am5Cpu, gpu: gpu4090, psu: psu1000 });
    expect(report.errors.some((e) => e.category === 'psu-power')).toBe(false);
  });

  it('does not block an incomplete build (browsing/building without all parts selected)', () => {
    const report = checkBuildCompatibility({ cpu: am5Cpu });
    expect(report.status).not.toBe('error');
  });

  it('is not orderable until all required slots are filled', () => {
    const components = { cpu: am5Cpu, motherboard: am5Mobo };
    const report = checkBuildCompatibility(components);
    expect(isBuildOrderable(components, report)).toBe(false);
  });
});
