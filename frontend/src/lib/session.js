// Guests are identified to the backend via an `x-session-id` header (see
// backend/README.md "Guest cart usage"). Generate one ID per browser and
// keep it in localStorage so a guest's cart survives a page reload, and
// gets merged into their account automatically the moment they log in
// (Phase 2 `mergeGuestCart`, wired up on the frontend in Phase 7c).
const KEY = 'buildforge_session_id';

export function getSessionId() {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}
