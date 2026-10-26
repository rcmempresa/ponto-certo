# Architecture
- Keep document expiry date rules in a shared document-rules module and cover them with focused tests so employee, administrator and dashboard views agree.
- Store one-level document subcategories in a separate protected table linked to documents; use persisted categories and an atomic admin-only rename function to update parent names across categories, subcategories and documents without changing document associations.
- Clear subcategory assignments when changing the parent category and enforce parent consistency in the database to prevent mismatched document organization.
- Derive dashboard expiry status from document dates on read; activate scheduled email delivery only after an owned sender domain is configured.