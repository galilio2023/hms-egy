# 💰 Track 3: Operations & Financials Plan

## [ ] Pharmacy & Inventory
- [x] Enforce pharmacy safety ceilings (prescribedQuantity calculation)
- [x] Optimize medication search with GIN Trigram indexes
- [x] Implement robust Drug Interaction (DDI) matching using Trigram similarity
- [x] Add GIN Trigram indexes to medication_interactions for real-time DDI performance
- [x] Optimize trigram matching logic using % operator for guaranteed index utilization
- [x] Resolve canonical generics before interaction matching to prevent polypharmacy query blow-up
- [x] Prevent cross-table deadlocks by enforcing deterministic sequential locking order in dispensing
- [x] Add composite index to housekeeping_tasks for high-performance KPI reporting
- [x] Stock adjustment audit logs
- [x] Implement ETA E-invoicing integration (Client, Transformer, and Submission Actions)
