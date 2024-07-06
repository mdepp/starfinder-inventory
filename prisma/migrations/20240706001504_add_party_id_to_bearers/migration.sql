/*
  Warnings:

  - Added the required column `partyId` to the `InventoryItemBearer` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_InventoryItemBearer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "partyId" INTEGER NOT NULL,
    CONSTRAINT "InventoryItemBearer_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_InventoryItemBearer" ("id", "name") SELECT "id", "name" FROM "InventoryItemBearer";
DROP TABLE "InventoryItemBearer";
ALTER TABLE "new_InventoryItemBearer" RENAME TO "InventoryItemBearer";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
