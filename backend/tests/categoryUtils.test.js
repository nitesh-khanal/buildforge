const { mergeCategoryData } = require('../utils/categoryUtils');

const CATEGORIES = ['cpu', 'gpu', 'motherboard'];

describe('mergeCategoryData', () => {
  it('merges label/description/image/displayOrder from matching Category docs', () => {
    const counts = { cpu: 5, gpu: 2 };
    const docs = [
      { slug: 'cpu', label: 'Processors', description: 'Brains of the build', image: '/cpu.png', displayOrder: 2, isActive: true },
      { slug: 'gpu', label: 'Graphics Cards', displayOrder: 1, isActive: true },
    ];

    const result = mergeCategoryData(CATEGORIES, counts, docs);

    expect(result).toHaveLength(3);
    const gpu = result.find((c) => c.slug === 'gpu');
    expect(gpu).toMatchObject({ label: 'Graphics Cards', count: 2, displayOrder: 1 });
    const cpu = result.find((c) => c.slug === 'cpu');
    expect(cpu).toMatchObject({ label: 'Processors', description: 'Brains of the build', image: '/cpu.png', count: 5 });
  });

  it('falls back to the raw slug and zero count when no doc or count exists', () => {
    const result = mergeCategoryData(CATEGORIES, {}, []);
    const motherboard = result.find((c) => c.slug === 'motherboard');
    expect(motherboard).toMatchObject({ slug: 'motherboard', label: 'motherboard', count: 0, isActive: true });
  });

  it('sorts by displayOrder, then label, ignoring input order', () => {
    const docs = [
      { slug: 'motherboard', label: 'Motherboard', displayOrder: 3, isActive: true },
      { slug: 'cpu', label: 'CPU', displayOrder: 1, isActive: true },
      { slug: 'gpu', label: 'GPU', displayOrder: 2, isActive: true },
    ];
    const result = mergeCategoryData(CATEGORIES, {}, docs);
    expect(result.map((c) => c.slug)).toEqual(['cpu', 'gpu', 'motherboard']);
  });

  it('filters out inactive categories only when activeOnly is set', () => {
    const docs = [
      { slug: 'cpu', label: 'CPU', isActive: true },
      { slug: 'gpu', label: 'GPU', isActive: false },
      { slug: 'motherboard', label: 'Motherboard', isActive: true },
    ];

    const all = mergeCategoryData(CATEGORIES, {}, docs);
    expect(all).toHaveLength(3);

    const activeOnly = mergeCategoryData(CATEGORIES, {}, docs, { activeOnly: true });
    expect(activeOnly.map((c) => c.slug)).toEqual(['cpu', 'motherboard']);
  });

  it('ignores an extra Category doc for a slug not in CATEGORIES', () => {
    const docs = [{ slug: 'accessories', label: 'Accessories', isActive: true }];
    const result = mergeCategoryData(CATEGORIES, {}, docs);
    expect(result).toHaveLength(3);
    expect(result.find((c) => c.slug === 'accessories')).toBeUndefined();
  });

  it('never mutates the input arrays', () => {
    const docs = [{ slug: 'cpu', label: 'CPU', isActive: true }];
    const docsCopy = JSON.parse(JSON.stringify(docs));
    mergeCategoryData(CATEGORIES, { cpu: 1 }, docs, { activeOnly: true });
    expect(docs).toEqual(docsCopy);
  });
});
