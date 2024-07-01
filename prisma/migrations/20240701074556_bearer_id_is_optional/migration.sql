-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_InventoryItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "description" TEXT NOT NULL,
    "bulk" REAL NOT NULL,
    "bearerId" INTEGER,
    "category" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    CONSTRAINT "InventoryItem_bearerId_fkey" FOREIGN KEY ("bearerId") REFERENCES "InventoryItemBearer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_InventoryItem" ("bearerId", "bulk", "category", "count", "description", "id") SELECT "bearerId", "bulk", "category", "count", "description", "id" FROM "InventoryItem";
DROP TABLE "InventoryItem";
ALTER TABLE "new_InventoryItem" RENAME TO "InventoryItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
