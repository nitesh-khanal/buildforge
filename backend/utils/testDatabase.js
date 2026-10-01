// Integration suites must never clean up a live database by accident.
function assertTestDatabase(uri) {
  let name;
  try { name = new URL(uri).pathname.slice(1); } catch { throw new Error('Set MONGODB_URI to a dedicated test database.'); }
  if (!/(^|[_-])test($|[_-])/i.test(name)) throw new Error('Integration tests require a database name containing a separate test marker (for example buildforge_ci_test).');
}
module.exports = assertTestDatabase;
