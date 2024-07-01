/*
  Warnings:

  - Added the required column `category` to the `InventoryItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `count` to the `InventoryItem` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_InventoryItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "description" TEXT NOT NULL,
    "bulk" REAL NOT NULL,
    "bearerId" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    CONSTRAINT "InventoryItem_bearerId_fkey" FOREIGN KEY ("bearerId") REFERENCES "InventoryItemBearer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_InventoryItem" ("bearerId", "bulk", "description", "id") SELECT "bearerId", "bulk", "description", "id" FROM "InventoryItem";
DROP TABLE "InventoryItem";
ALTER TABLE "new_InventoryItem" RENAME TO "InventoryItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
