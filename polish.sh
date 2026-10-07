#!/usr/bin/env bash
# polish.sh — Phase 6c. Idempotent. Safe to run twice.

set -e

ROOT="$(pwd)"
cd "$ROOT"

say() { printf "  %s\n" "$*"; }
ok()  { printf "  \033[32m✓\033[0m %s\n" "$*"; }
skp() { printf "  \033[33m·\033[0m %s\n" "$*"; }
err() { printf "  \033[31m✗\033[0m %s\n" "$*" >&2; }

LIST_SKELETON='<div class="a-skeleton-row">
            <div class="a-skeleton a-skeleton-block a-skeleton-block--short"></div>
            <div class="a-skeleton a-skeleton-block"></div>
            <div class="a-skeleton a-skeleton-block a-skeleton-block--short"></div>
          </div>
          <div class="a-skeleton-row">
            <div class="a-skeleton a-skeleton-block a-skeleton-block--short"></div>
            <div class="a-skeleton a-skeleton-block"></div>
            <div class="a-skeleton a-skeleton-block a-skeleton-block--short"></div>
          </div>
          <div class="a-skeleton-row">
            <div class="a-skeleton a-skeleton-block a-skeleton-block--short"></div>
            <div class="a-skeleton a-skeleton-block"></div>
            <div class="a-skeleton a-skeleton-block a-skeleton-block--short"></div>
          </div>'

GRID_SKELETON='<div class="a-skeleton" style="height: 400px;"></div>'

# Replace the "Loading…" empty state in a file with a given skeleton.
# Usage: replace_loading <file> <skeleton-string>
replace_loading() {
  local file="$1"
  local replacement="$2"

  if [ ! -f "$file" ]; then
    err "missing: $file"
    return 1
  fi

  if grep -q 'a-skeleton' "$file"; then
    skp "already has skeleton: $file"
    return 0
  fi

  # Match: <div class="a-empty"><h3>Loading…</h3></div>
  # across whitespace variations. Use perl for multiline reliability.
  if perl -0777 -i -pe "s{<div class=\"a-empty\">\s*<h3>Loading…</h3>\s*</div>}{$replacement}g" "$file"; then
    ok "updated: $file"
  else
    err "could not update: $file"
    return 1
  fi
}

echo ""
echo "Phase 6c — polish"
echo "================="

echo ""
echo "Admin HTML — replacing Loading states with skeletons"

# List-style pages
replace_loading "admin/dashboard.html"    "$LIST_SKELETON"
replace_loading "admin/bookings.html"     "$LIST_SKELETON"
replace_loading "admin/services.html"     "$LIST_SKELETON"
replace_loading "admin/gallery.html"      "$LIST_SKELETON"
replace_loading "admin/availability.html" "$LIST_SKELETON"
replace_loading "admin/clients.html"      "$LIST_SKELETON"
replace_loading "admin/blog.html"         "$LIST_SKELETON"

# Grid-style page
replace_loading "admin/calendar.html"     "$GRID_SKELETON"

echo ""
echo "Admin CSS — appending mobile fix"

CSS_FILE="admin/assets/admin.css"
if grep -q 'max-width: 400px' "$CSS_FILE"; then
  skp "already has mobile fix: $CSS_FILE"
else
  cat >> "$CSS_FILE" <<'EOF'

/* --------------------------------------------------------------------------
   Narrow-phone fix — dashboard stat grid
   -------------------------------------------------------------------------- */

@media (max-width: 400px) {
  .a-stat-grid { grid-template-columns: 1fr; }
}
EOF
  ok "appended mobile fix: $CSS_FILE"
fi

echo ""
echo "shared.js — updating applyBusinessName"

SHARED_FILE="assets/js/public/shared.js"
if grep -q 'Replace "Salon" in the title' "$SHARED_FILE"; then
  skp "already updated: $SHARED_FILE"
else
  # Extract everything before the old function
  BEFORE=$(awk '/^export function applyBusinessName\(/{exit} {print}' "$SHARED_FILE")
  # Extract everything after the old function's closing brace
  AFTER=$(awk 'f{print} /^export function applyBusinessName\(/{f=1} f&&/^}/{f=2}' "$SHARED_FILE" | tail -n +2)

  cat > "$SHARED_FILE" <<EOF
$BEFORE
export function applyBusinessName(name) {
  if (!name) return;

  /* Replace every element tagged with data-business-name */
  document.querySelectorAll('[data-business-name]').forEach(el => {
    el.textContent = name;
  });

  /* Replace "Salon" in the title if present. Works for titles like
     "Home — Salon" or "Bookings — Salon" without touching the page part. */
  if (document.title.includes('Salon')) {
    document.title = document.title.replace(/\bSalon\b/g, name);
  }
}
$AFTER
EOF
  ok "updated: $SHARED_FILE"
fi

echo ""
echo "Done."
echo ""